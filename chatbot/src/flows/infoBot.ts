import fs from 'fs'
import path from 'path'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { Session, getSession, updateSession, appendToHistory } from '../lib/session'
import { sendText, sendButtons } from '../lib/whatsapp'
import { ai } from '../services/ai'
import { retrieve } from '../services/rag'
import { GoogleCalendarService } from '../services/googleCalendar'

const APPOINTMENT_COMPLETE = 'CITA_CONFIRMADA'

function loadPrompt(name: string): string {
  return fs.readFileSync(path.join(__dirname, '..', 'prompts', name), 'utf-8')
}

export interface BotContext {
  text: string
  from: string
  client: any
  session: Session
  botConfig?: any
}

export async function handleInfoBot(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  if (session.current_flow === 'appointment') {
    return continueAppointmentFlow(ctx)
  }

  // Classify intent
  const history = session.history ?? []
  const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n')
  const discriminator = loadPrompt('prompt-discriminator.txt').replace('{HISTORY}', historyText)

  const intentMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: discriminator },
    { role: 'user', content: text },
  ]

  const { intent } = await ai.determineIntent(intentMessages)

  if (intent === 'agendar_cita') {
    return startAppointmentFlow(ctx)
  }

  // consultar_empresa or hablar → AI conversation with RAG context
  const chunks = await retrieve(text, clientId).catch(() => [] as string[])
  const ragContext = chunks.length > 0
    ? `Información real de la empresa:\n\n${chunks.join('\n\n')}`
    : ''

  const basePrompt = ctx.botConfig?.system_prompt || loadPrompt('prompt-talker.txt')
  const talker = basePrompt
    .replace('{BUSINESSDATA.companyName}', client.company_name ?? '')
    .replace('{BUSINESSDATA.companyAddress}', client.company_address ?? '')
    .replace('{BUSINESSDATA.whatsappPhone}', client.whatsapp_phone ?? '')
    .replace('{BUSINESSDATA.companyEmail}', client.company_email ?? '')
    .replace('{BUSINESSDATA.facebookLink}', client.facebook_link ?? '')
    .replace('{BUSINESSDATA.instagramLink}', client.instagram_link ?? '')
    .replace('{HISTORY}', historyText)
    .replace('{RAG_CONTEXT}', ragContext)

  const chatMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: talker },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: text },
  ]

  const response = await ai.createChat(chatMessages)
  if (response) {
    await sendText(pid, token, from, response)
    await appendToHistory(clientId, from, 'assistant', response)
  }
}

async function startAppointmentFlow(ctx: BotContext) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  await updateSession(clientId, from, {
    current_flow: 'appointment',
    flow_step: 'collecting',
    state: {},
  })

  const freshSession = await getSession(clientId, from)
  await runAppointmentAI({ ...ctx, session: freshSession })
}

async function continueAppointmentFlow(ctx: BotContext) {
  await runAppointmentAI(ctx)
}

async function runAppointmentAI(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const history = session.history ?? []
  const now = new Date().toLocaleString('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  })

  const systemPrompt = loadPrompt('prompt-appointment.txt')
    .replace('{BUSINESSDATA.companyName}', client.company_name ?? '')
    .replace('{BUSINESSDATA.companyType}', client.company_type ?? '')
    .replace('{CURRENTDAY}', now)
    .replace('{HISTORY}', history.map(m => `${m.role}: ${m.content}`).join('\n'))
    .replace('{PRODUCTS}', '')
    .replace('{APPOINTMENT_COMPLETE}', APPOINTMENT_COMPLETE)

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: text },
  ]

  const response = await ai.createChat(messages)

  if (response.includes(APPOINTMENT_COMPLETE)) {
    await appendToHistory(clientId, from, 'user', text)
    return finishAppointment(ctx)
  }

  await sendText(pid, token, from, response)
  await appendToHistory(clientId, from, 'assistant', response)
}

async function finishAppointment(ctx: BotContext) {
  const { from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const history = session.history ?? []

  const messages: ChatCompletionMessageParam[] = history.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const { appointment } = await ai.determineAppointment(messages)

  if (!appointment.date) {
    await sendText(pid, token, from, 'Hubo un problema al registrar tu cita. Por favor intenta de nuevo.')
    return
  }

  try {
    const date = new Date(appointment.date)

    if (client.google_calendar_id && client.google_calendar_key_url) {
      const calendar = new GoogleCalendarService(client.google_calendar_id, client.google_calendar_key_url)
      const available = await calendar.checkAvailability(date)

      if (!available) {
        await sendText(pid, token, from,
          `Lo siento, el horario ${date.toLocaleString('es-MX')} no está disponible. ¿Te gustaría elegir otro horario?`)
        await updateSession(clientId, from, { flow_step: 'collecting' })
        return
      }

      await calendar.createEvent(
        `Cita — ${appointment.name}`,
        `Servicio: ${appointment.service}\nTeléfono: ${appointment.phone}`,
        date
      )
    }

    const dateStr = new Date(appointment.date).toLocaleString('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'America/Mexico_City',
    })

    await sendText(pid, token, from,
      `✅ ¡Cita agendada!\n\n👤 *${appointment.name}*\n📋 ${appointment.service}\n📅 ${dateStr}\n\nTe esperamos. Si necesitas cambios, escríbenos.`)
  } catch (err) {
    console.error('[InfoBot] Calendar error:', err)
    await sendText(pid, token, from,
      '✅ Tus datos fueron registrados. Nos pondremos en contacto para confirmar tu cita.')
  }

  await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
}
