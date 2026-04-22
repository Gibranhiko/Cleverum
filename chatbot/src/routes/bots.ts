import { Router } from 'express'
import supabase from '../lib/supabase'
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
    .select('id, company_name, bot_type, bot_active, whatsapp_phone, wa_phone_number_id')
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
