import { Request, Response } from 'express'
import supabase from '../lib/supabase'
import { getSession, updateSession, appendToHistory } from '../lib/session'
import { sendText } from '../lib/whatsapp'
import { handleInfoBot } from '../flows/infoBot'
import { handleCatalogBot } from '../flows/catalogBot'
import { handleLeadsBot } from '../flows/leadsBot'
import { ai } from '../services/ai'
import { ClientRow, BotConfigRow } from '../types'

const COMMANDS = new Set(['botoff', 'status', 'boton'])

const OPT_OUT_SIGNALS = [
  'stop', 'unsubscribe', 'darme de baja', 'darse de baja',
  'dejar de recibir', 'no quiero mensajes', 'ya no quiero mensajes',
  'cancelar mensajes', 'cancelar suscripcion', 'cancelar suscripción',
]

function mightBeOptOut(text: string): boolean {
  const lower = text.toLowerCase()
  return OPT_OUT_SIGNALS.some(s => lower.includes(s))
}

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
  console.log('[Webhook] POST hit')
  res.sendStatus(200) // acknowledge immediately — Meta requires < 5s

  try {
    const body = req.body

    if (!body || typeof body !== 'object') {
      console.error('[Webhook] Empty or non-JSON body — is express.json() missing?')
      return
    }

    if (body.object !== 'whatsapp_business_account') {
      console.warn('[Webhook] Unexpected object type:', body.object)
      return
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'phone_number_quality_update') {
          const { display_phone_number, event, current_limit } = change.value ?? {}
          console.warn(`[Meta Quality] ${display_phone_number}: event=${event}, limit=${current_limit}`)
          continue
        }

        if (change.field === 'account_alerts') {
          console.error('[Meta Alert]', JSON.stringify(change.value))
          continue
        }

        if (change.field !== 'messages') {
          console.log('[Webhook] Skipping non-messages field:', change.field)
          continue
        }

        const value = change.value
        const phoneNumberId: string = value.metadata?.phone_number_id
        const messages = value.messages ?? []

        if (messages.length === 0) {
          console.log('[Webhook] Change has no messages (status update only)')
          continue
        }

        console.log(`[Webhook] ${messages.length} message(s) for phone_number_id=${phoneNumberId}`)

        for (const message of messages) {
          console.log(`[Webhook] Processing type=${message.type} from=${message.from}`)
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
  const isInteractive = message.type === 'interactive'

  if (message.type === 'text') {
    text = message.text?.body ?? ''
  } else if (isInteractive) {
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
  console.log(`[Webhook] Client found: ${client.company_name} (bot_type=${client.bot_type} bot_active=${client.bot_active})`)

  const textLower = text.trim().toLowerCase()
  if (COMMANDS.has(textLower)) return handleCommand(textLower, from, client)
  if (!client.bot_active) {
    console.warn('[Webhook] Bot is inactive for this client — message ignored')
    return
  }

  const session = await getSession(client.id, from)
  if (session.bot_disabled_for_user) {
    console.warn(`[Webhook] Bot disabled for user ${from}`)
    return
  }
  if (session.human_takeover) {
    console.warn(`[Webhook] Human takeover active for ${from}`)
    return
  }

  // Handle pending opt-out confirmation
  if (session.flow_step === 'opt_out_confirm') {
    return handleOptOutConfirmation(text, from, client, session)
  }

  // AI-driven opt-out detection — only runs on plain text with signal words (not button taps)
  if (!isInteractive && mightBeOptOut(text)) {
    const { is_opt_out } = await ai.isOptOutIntent(text, session.history ?? [])
    if (is_opt_out) {
      await updateSession(client.id, from, { flow_step: 'opt_out_confirm' })
      await sendText(
        client.wa_phone_number_id,
        client.wa_access_token,
        from,
        'Entiendo que quieres darte de baja 🙏\n\n¿Confirmas que ya no deseas recibir mensajes de este número?\n\nResponde *Sí* para confirmar o *No* para continuar.'
      )
      return
    }
  }

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

async function handleOptOutConfirmation(text: string, from: string, client: ClientRow, session: any) {
  const { id: clientId, wa_phone_number_id: pid, wa_access_token: token } = client
  const { confirmed } = await ai.isOptOutConfirmation(text)

  if (confirmed) {
    await updateSession(clientId, from, { bot_disabled_for_user: true, flow_step: null, current_flow: null })
    await sendText(pid, token, from,
      'Listo, te damos de baja ✅\n\nYa no recibirás mensajes de este número. Si cambias de opinión en el futuro, escribe *HOLA*.'
    )
    return
  }

  // Not confirmed — clear the pending state and resume normal routing
  await updateSession(clientId, from, { flow_step: null })
  await sendText(pid, token, from, 'No hay problema, continuamos 😊')

  await appendToHistory(clientId, from, 'user', text)
  const botConfig = await getCachedBotConfig(clientId)
  const ctx = { text, from, client, session: { ...session, flow_step: null }, botConfig }

  switch (client.bot_type) {
    case 'informativo': return handleInfoBot(ctx)
    case 'catalogo':    return handleCatalogBot(ctx)
    case 'leads':       return handleLeadsBot(ctx)
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
