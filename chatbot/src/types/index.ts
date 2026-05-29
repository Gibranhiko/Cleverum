import { Session } from '../lib/session'

export interface ClientRow {
  id: string
  company_name: string
  company_type: string | null
  company_address: string | null
  company_email: string | null
  whatsapp_phone: string | null
  bot_type: 'informativo' | 'catalogo' | 'leads' | 'servicios'
  bot_active: boolean
  wa_phone_number_id: string | null
  wa_access_token: string | null
  google_calendar_id: string | null
  google_calendar_key_url: string | null
  facebook_link: string | null
  instagram_link: string | null
  ticket_prefix: string | null
  ticket_counter: number
  mascot_name: string | null
  mascot_image_url: string | null
  mascot_media_id: string | null
}

export interface TicketRow {
  id: string
  folio: string
  client_id: string
  customer_phone: string
  customer_name: string | null
  device_type: string | null
  device_brand: string | null
  device_model: string | null
  problem_description: string | null
  problem_category: string | null
  photos: string[]
  status: 'recibido' | 'diagnostico' | 'cotizado' | 'aprobado' | 'en_reparacion' | 'listo' | 'entregado' | 'rechazado' | 'cancelado'
  status_history: { status: string; at: string; by: string; note: string | null }[]
  quote_amount: number | null
  internal_notes: string | null
  created_at: string
  updated_at: string
}

export interface ServiceRow {
  id: string
  client_id: string
  name: string
  description: string | null
  category: string | null
  price_amount: number | null
  price_label: string | null
  estimated_duration: string | null
  image_url: string | null
  examples: string | null
  is_active: boolean
  display_order: number
}

export interface DayHours {
  open: string            // 'HH:mm'
  close: string           // 'HH:mm'
  open2?: string          // horario partido (opcional)
  close2?: string
}

export interface IntakeField {
  key: string
  label: string
  type: 'text' | 'list'
  options?: string[]
  required?: boolean
}

export interface AppointmentSettings {
  client_id: string
  enabled: boolean
  timezone: string
  weekly_hours: (DayHours | null)[]   // índice 0=domingo .. 6=sábado
  slot_minutes: number
  buffer_minutes: number
  lead_time_minutes: number
  horizon_days: number
  max_slots_listed: number
  closed_dates: string[]              // ['YYYY-MM-DD', ...]
  service_label: string
  use_services_catalog: boolean
  intake_fields: IntakeField[]
}

export type AppointmentStatus = 'nueva' | 'confirmada' | 'completada' | 'cancelada' | 'no_asistio'

export interface AppointmentRow {
  id: string
  client_id: string
  customer_phone: string
  customer_name: string | null
  service: string | null
  starts_at: string
  ends_at: string
  extra: Record<string, unknown>
  status: AppointmentStatus
  status_history: { status: string; at: string; by: string; note: string | null }[]
  origin: 'whatsapp' | 'panel'
  calendar_event_id: string | null
  calendar_synced: boolean
  internal_notes: string | null
  created_at: string
  updated_at: string
}

export interface BotConfigRow {
  client_id: string
  welcome_message: string | null
  system_prompt: string | null
  closing_message: string | null
  intents_enabled: string[]
  qualification_questions: string[]
}

export interface BotContext {
  text: string
  from: string
  client: ClientRow
  session: Session
  botConfig?: BotConfigRow | null
}
