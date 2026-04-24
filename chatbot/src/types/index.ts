import { Session } from '../lib/session'

export interface ClientRow {
  id: string
  company_name: string
  company_type: string | null
  company_address: string | null
  company_email: string | null
  whatsapp_phone: string | null
  bot_type: 'informativo' | 'catalogo' | 'leads'
  bot_active: boolean
  wa_phone_number_id: string | null
  wa_access_token: string | null
  google_calendar_id: string | null
  google_calendar_key_url: string | null
  facebook_link: string | null
  instagram_link: string | null
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
