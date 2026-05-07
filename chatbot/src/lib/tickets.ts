import supabase from './supabase'
import { ClientRow, TicketRow } from '../types'

export interface IntakeData {
  customer_phone: string
  customer_name?: string | null
  device_type?: string | null
  device_brand?: string | null
  device_model?: string | null
  problem_description?: string | null
  problem_category?: string | null
  photos?: string[]
}

function resolvePrefix(client: ClientRow): string {
  if (client.ticket_prefix) return client.ticket_prefix.toUpperCase()
  const fallback = (client.company_name ?? 'CLI').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
  return fallback || 'CLI'
}

export async function createTicket(client: ClientRow, intake: IntakeData): Promise<{ folio: string; ticketId: string } | null> {
  const { data: nextNumberData, error: counterError } = await supabase.rpc('next_ticket_number', {
    p_client_id: client.id,
  })

  if (counterError || nextNumberData == null) {
    console.error('[Tickets] next_ticket_number error:', counterError)
    return null
  }

  const prefix = resolvePrefix(client)
  const folio = `${prefix}-${nextNumberData}`

  const initialHistory = [{
    status: 'recibido',
    at: new Date().toISOString(),
    by: 'bot',
    note: null as string | null,
  }]

  const { data, error } = await supabase
    .from('tickets')
    .insert({
      folio,
      client_id: client.id,
      customer_phone: intake.customer_phone,
      customer_name: intake.customer_name ?? null,
      device_type: intake.device_type ?? null,
      device_brand: intake.device_brand ?? null,
      device_model: intake.device_model ?? null,
      problem_description: intake.problem_description ?? null,
      problem_category: intake.problem_category ?? null,
      photos: intake.photos ?? [],
      status: 'recibido',
      status_history: initialHistory,
    })
    .select('id, folio')
    .single()

  if (error || !data) {
    console.error('[Tickets] insert error:', error)
    return null
  }

  console.log(`[Tickets] created folio=${data.folio} id=${data.id} client=${client.company_name}`)
  return { folio: data.folio, ticketId: data.id }
}

export async function getTicketByFolio(clientId: string, folio: string): Promise<TicketRow | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('client_id', clientId)
    .ilike('folio', folio)
    .single()

  if (error || !data) return null
  return data as TicketRow
}

const STATUS_LABELS: Record<string, string> = {
  recibido:      'Recibido 📥',
  diagnostico:   'En diagnóstico 🔍',
  cotizado:      'Cotización lista 💰',
  aprobado:      'Aprobado ✅',
  en_reparacion: 'En reparación 🔧',
  listo:         'Listo para recoger 📦',
  entregado:     'Entregado ✓',
  rechazado:     'Cotización rechazada ✕',
  cancelado:     'Cancelado',
}

export function formatTicketStatus(ticket: TicketRow): string {
  const lines: string[] = []
  lines.push(`📦 *Orden ${ticket.folio}*`)

  const equipo = [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ').trim()
  if (equipo) lines.push(`• Equipo: ${equipo}`)

  if (ticket.problem_description) {
    const prob = ticket.problem_description.length > 80
      ? ticket.problem_description.slice(0, 77) + '...'
      : ticket.problem_description
    lines.push(`• Problema: ${prob}`)
  }

  lines.push(`• Estado: ${STATUS_LABELS[ticket.status] ?? ticket.status}`)

  const lastEntry = ticket.status_history?.[ticket.status_history.length - 1]
  if (lastEntry) {
    const date = new Date(lastEntry.at).toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Mexico_City',
    })
    lines.push(`• Última actualización: ${date}`)
    if (lastEntry.note) lines.push(`• Nota: ${lastEntry.note}`)
  }

  if (ticket.quote_amount != null && (ticket.status === 'cotizado' || ticket.status === 'aprobado')) {
    lines.push(`• Cotización: $${ticket.quote_amount}`)
  }

  return lines.join('\n')
}
