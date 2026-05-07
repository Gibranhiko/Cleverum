import { randomBytes } from 'crypto'
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

// Alfabeto sin caracteres ambiguos (excluye O, 0, I, 1).
// 32 chars × 6 posiciones = ~1 billón de combinaciones por cliente.
const FOLIO_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const FOLIO_SUFFIX_LEN = 6
const FOLIO_MAX_RETRIES = 5

function resolvePrefix(client: ClientRow): string {
  if (client.ticket_prefix) return client.ticket_prefix.toUpperCase()
  const fallback = (client.company_name ?? 'CLI').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
  return fallback || 'CLI'
}

function randomFolioSuffix(): string {
  const bytes = randomBytes(FOLIO_SUFFIX_LEN)
  let result = ''
  for (let i = 0; i < FOLIO_SUFFIX_LEN; i++) {
    result += FOLIO_ALPHABET[bytes[i] % FOLIO_ALPHABET.length]
  }
  return result
}

async function generateUniqueFolio(client: ClientRow): Promise<string | null> {
  const prefix = resolvePrefix(client)
  for (let attempt = 0; attempt < FOLIO_MAX_RETRIES; attempt++) {
    const folio = `${prefix}${randomFolioSuffix()}`
    const { data } = await supabase
      .from('tickets')
      .select('id')
      .eq('client_id', client.id)
      .eq('folio', folio)
      .maybeSingle()
    if (!data) return folio
    console.warn(`[Tickets] folio collision on ${folio} (attempt ${attempt + 1}), retrying`)
  }
  console.error(`[Tickets] failed to generate unique folio after ${FOLIO_MAX_RETRIES} attempts`)
  return null
}

export async function createTicket(client: ClientRow, intake: IntakeData): Promise<{ folio: string; ticketId: string } | null> {
  const folio = await generateUniqueFolio(client)
  if (!folio) return null

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
  const normalized = folio.trim().toUpperCase()
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('client_id', clientId)
    .eq('folio', normalized)
    .maybeSingle()

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
