import { Request, Response } from 'express'
import supabase from '../lib/supabase'
import { getSession, updateSession, appendToHistory } from '../lib/session'
import { sendText } from '../lib/whatsapp'
import { handleInfoBot } from '../flows/infoBot'
import { handleCatalogBot } from '../flows/catalogBot'
import { handleLeadsBot } from '../flows/leadsBot'
import { ClientRow, BotConfigRow } from '../types'

const COMMANDS = new Set(['botoff', 'status', 'boton'])

// Client cache keyed by wa_phone_number_id
const clientCache = new Map<string, { client: ClientRow; expires: number }>()
// BotConfig cache keyed by client_id
const botConfigCache = new Map<string, { config: BotConfigRow | null; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000

async function getCachedClient(phoneNumberId: string) {
  const cached = clientCache.get(phoneNumberId)
  if (cached && cached.expires > Date.now()) return cached.client

  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('wa_phone_number_id', phoneNumberId)
    .single()

  if (data) clientCache.set(phoneNumberId, { client: data, expires: Date.now() + CACHE_TTL })
  return data ?? null
}

async function getCachedBotConfig(clientId: string) {
  const cached = botConfigCache.get(clientId)
  if (cached && cached.expires > Date.now()) return cached.config

  const { data } = await supabase
    .from('bot_configs')
    .select('*')
    .eq('client_id', clientId)
    .single()

  botConfigCache.set(clientId, { config: data ?? null, expires: Date.now() + CACHE_TTL })
  return data ?? null
}

export function invalidateClientCache(phoneNumberId: string) {
  clientCache.delete(phoneNumberId)
}

export async function handleWebhook(req: Request, res: Response) {
  res.sendStatus(200) // acknowledge immediately — Meta requires < 5s

  try {
    const body = req.body
    if (body.object !== 'whatsapp_business_account') return

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue
        const value = change.value
        const phoneNumberId: string = value.metadata?.phone_number_id

        for (const message of value.messages ?? []) {
          await processMessage(message, phoneNumberId).catch(err =>
            console.error('[Webhook] processMessage error:', err)
          )
        }
      }
    }
  } catch (err) {
    console.error('[Webhook] handler error:', err)
  }
}

async function processMessage(message: any, phoneNumberId: string) {
  const from: string = message.from
  let text = ''

  if (message.type === 'text') {
    text = message.text?.body ?? ''
  } else if (message.type === 'interactive') {
    const it = message.interactive
    if (it.type === 'button_reply') text = it.button_reply.id
    else if (it.type === 'list_reply') text = it.list_reply.id
  } else {
    return // ignore audio, image, etc.
  }

  if (!text.trim()) return

  const client = await getCachedClient(phoneNumberId)
  if (!client) {
    console.warn(`[Webhook] No client for phone_number_id: ${phoneNumberId}`)
    return
  }

  const textLower = text.trim().toLowerCase()
  if (COMMANDS.has(textLower)) return handleCommand(textLower, from, client)
  if (!client.bot_active) return

  const session = await getSession(client.id, from)
  if (session.bot_disabled_for_user) return
  if (session.human_takeover) return

  await appendToHistory(client.id, from, 'user', text)

  const botConfig = await getCachedBotConfig(client.id)
  const ctx = { text, from, client, session, botConfig }

  switch (client.bot_type) {
    case 'informativo': return handleInfoBot(ctx)
    case 'catalogo':    return handleCatalogBot(ctx)
    case 'leads':       return handleLeadsBot(ctx)
    default: console.warn(`[Webhook] Unknown bot_type: ${client.bot_type}`)
  }
}

async function handleCommand(cmd: string, from: string, client: ClientRow) {
  const { id: clientId, wa_phone_number_id: pid, wa_access_token: token } = client
  const session = await getSession(clientId, from)

  if (cmd === 'botoff') {
    const next = !session.bot_disabled_for_user
    await updateSession(clientId, from, { bot_disabled_for_user: next })
    await sendText(pid, token, from, next ? '🔕 Bot desactivado para este número.' : '🔔 Bot reactivado.')
  }

  if (cmd === 'status') {
    await sendText(pid, token, from,
      `Estado del bot: ${client.bot_active ? '✅ Activo' : '🔴 Inactivo'}`)
  }

  if (cmd === 'boton') {
    const next = !client.bot_active
    await supabase.from('clients').update({ bot_active: next }).eq('id', clientId)
    invalidateClientCache(pid)
    await sendText(pid, token, from, next ? '🔔 Bot activado.' : '🔕 Bot desactivado.')
  }
}
