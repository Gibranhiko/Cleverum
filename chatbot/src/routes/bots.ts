import { Router } from 'express'
import supabase from '../lib/supabase'
import { sendText } from '../lib/whatsapp'
import { appendToHistory } from '../lib/session'
import { invalidateClientCache } from '../webhook/handler'

const router = Router()

// Toggle bot active/inactive
router.put('/:clientId/toggle', async (req, res) => {
  const { clientId } = req.params

  const { data: client } = await supabase
    .from('clients')
    .select('bot_active, wa_phone_number_id')
    .eq('id', clientId)
    .single()

  if (!client) return res.status(404).json({ error: 'Client not found' })

  const next = !client.bot_active
  await supabase.from('clients').update({ bot_active: next }).eq('id', clientId)
  if (client.wa_phone_number_id) invalidateClientCache(client.wa_phone_number_id)

  res.json({ bot_active: next })
})

// Get status of all bots
router.get('/status', async (_req, res) => {
  const { data } = await supabase
    .from('clients')
    .select('id, company_name, bot_type, bot_active, whatsapp_phone')
    .eq('is_active', true)
    .order('company_name')

  res.json(data ?? [])
})

// Activate human takeover for a session
router.post('/:clientId/takeover', async (req, res) => {
  const { clientId } = req.params
  const { phone_number, active } = req.body

  if (!phone_number) return res.status(400).json({ error: 'phone_number is required' })

  await supabase
    .from('conversation_sessions')
    .update({ human_takeover: active ?? true })
    .eq('client_id', clientId)
    .eq('phone_number', phone_number)

  res.json({ ok: true })
})

// Send a message as the agent (human takeover mode)
router.post('/:clientId/send', async (req, res) => {
  const { clientId } = req.params
  const { phone_number, message } = req.body

  if (!phone_number || !message) {
    return res.status(400).json({ error: 'phone_number and message are required' })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('wa_phone_number_id, wa_access_token')
    .eq('id', clientId)
    .single()

  if (!client?.wa_phone_number_id || !client?.wa_access_token) {
    return res.status(400).json({ error: 'Client has no WhatsApp credentials configured' })
  }

  const { data: session } = await supabase
    .from('conversation_sessions')
    .select('last_message_at')
    .eq('client_id', clientId)
    .eq('phone_number', phone_number)
    .single()

  const lastMsg = session?.last_message_at ? new Date(session.last_message_at).getTime() : 0
  if (Date.now() - lastMsg > 23.5 * 3600 * 1000) {
    return res.status(400).json({
      error: 'WINDOW_EXPIRED',
      message: 'Han pasado más de 24h desde el último mensaje del usuario. No es posible enviar texto libre.',
    })
  }

  await sendText(client.wa_phone_number_id, client.wa_access_token, phone_number, message)
  await appendToHistory(clientId, phone_number, 'assistant', message)

  res.json({ ok: true })
})

// Update WhatsApp credentials
router.put('/:clientId/credentials', async (req, res) => {
  const { clientId } = req.params
  const { wa_phone_number_id, wa_access_token } = req.body

  const { error } = await supabase
    .from('clients')
    .update({ wa_phone_number_id, wa_access_token })
    .eq('id', clientId)

  if (error) return res.status(500).json({ error: error.message })

  if (wa_phone_number_id) invalidateClientCache(wa_phone_number_id)
  res.json({ ok: true })
})

export default router
