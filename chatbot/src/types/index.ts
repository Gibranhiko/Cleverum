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
