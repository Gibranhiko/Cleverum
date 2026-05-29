import fs from 'fs'
import path from 'path'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { getSession, updateSession, appendToHistory } from '../lib/session'
import { sendText, sendButtons, sendList } from '../lib/whatsapp'
import { ai } from '../services/ai'
import { getRagContext } from '../services/rag'
import { GoogleCalendarService } from '../services/googleCalendar'
import supabase from '../lib/supabase'
import { todayISO } from '../lib/slots'
import {
  getAppointmentSettings,
  getDbBusyForDay,
  getDbBusyForHorizon,
  bookAppointment,
} from '../lib/appointments'
import { BotContext, AppointmentSettings } from '../types'

const APPOINTMENT_COMPLETE = 'CITA_CONFIRMADA'
const SLOTS_READY = 'DATOS_LISTOS'

function loadPrompt(name: string): string {
  return fs.readFileSync(path.join(__dirname, '..', 'prompts', name), 'utf-8')
}

export async function handleInfoBot(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  // ¿Flujo de slots habilitado para este cliente? (settings.enabled + Calendar)
  const settings = await getAppointmentSettings(clientId)
  const slotsEnabled = !!(
    settings?.enabled &&
    client.google_calendar_id &&
    client.google_calendar_key_url
  )

  if (session.current_flow === 'appointment') {
    return slotsEnabled
      ? continueSlotAppointment(ctx, settings!)
      : continueAppointmentFlow(ctx)
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
  console.log(`[InfoBot] intent="${intent}" text="${text.slice(0, 50)}"`)

  if (intent === 'agendar_cita') {
    return slotsEnabled ? startSlotAppointment(ctx, settings!) : startAppointmentFlow(ctx)
  }

  const needsRag = intent === 'consultar_empresa' || intent === 'consultar_servicios'
  const ragContext = needsRag
    ? await getRagContext(`${text} ${client.company_name ?? ''}`, clientId)
    : ''
  console.log(`[InfoBot] needsRag=${needsRag} RAG context length=${ragContext.length}`)

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

  const productsContext = await getRagContext(
    `servicios productos ${client.company_name ?? ''} ${text}`,
    clientId,
    'Servicios disponibles en la empresa:'
  )
  console.log(`[InfoBot/Appointment] PRODUCTS context length=${productsContext.length}`)

  const systemPrompt = loadPrompt('prompt-appointment.txt')
    .replace('{BUSINESSDATA.companyName}', client.company_name ?? '')
    .replace('{BUSINESSDATA.companyType}', client.company_type ?? '')
    .replace('{CURRENTDAY}', now)
    .replace('{HISTORY}', history.map(m => `${m.role}: ${m.content}`).join('\n'))
    .replace('{PRODUCTS}', productsContext)
    .replace('{APPOINTMENT_COMPLETE}', APPOINTMENT_COMPLETE)

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: text },
  ]

  const response = await ai.createChat(messages)

  if (response.includes(APPOINTMENT_COMPLETE)) {
    console.log(`[InfoBot] CITA_CONFIRMADA token detected — finishing appointment for ${from}`)
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

// ═══════════════════════════════════════════════════════════
// FLUJO DE CITAS CON SLOTS (Google Calendar + panel) — devplan-citas.md
// ═══════════════════════════════════════════════════════════

interface ApptState {
  name?: string
  service?: string
  preferred_date?: string
  extra?: Record<string, string>
  chosen_day?: string
  offered_slots?: string[]
  chosen_slot?: string
  [key: string]: unknown
}

function getCalendar(client: BotContext['client']): GoogleCalendarService | null {
  if (client.google_calendar_id && client.google_calendar_key_url) {
    return new GoogleCalendarService(client.google_calendar_id, client.google_calendar_key_url)
  }
  return null
}

function fmtTime(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, 'HH:mm')
}

// Día calendario legible en español, sin corrimientos de tz (usa mediodía UTC).
function fmtDay(dayISO: string): string {
  return formatInTimeZone(new Date(`${dayISO}T12:00:00Z`), 'UTC', "EEEE d 'de' MMMM", { locale: es })
}

async function fetchServiceNames(clientId: string): Promise<string[]> {
  const { data } = await supabase
    .from('services')
    .select('name')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('display_order')
  return (data ?? []).map((s: any) => s.name)
}

async function buildServicesText(clientId: string, settings: AppointmentSettings): Promise<string> {
  if (!settings.use_services_catalog) return ''
  const names = await fetchServiceNames(clientId)
  return names.length ? ` (opciones: ${names.join(', ')})` : ''
}

function buildExtraFieldsText(settings: AppointmentSettings): string {
  const fields = settings.intake_fields ?? []
  if (!fields.length) return ''
  return fields
    .map((f, i) => {
      const opts = f.type === 'list' && f.options?.length ? ` (opciones: ${f.options.join(', ')})` : ''
      return `${i + 4}. ${f.label}${opts}`
    })
    .join('\n')
}

// ─── Entrada ─────────────────────────────────────────────────
async function startSlotAppointment(ctx: BotContext, settings: AppointmentSettings) {
  const { from, client } = ctx
  await updateSession(client.id, from, { current_flow: 'appointment', flow_step: 'collecting', state: {} })
  const fresh = await getSession(client.id, from)
  return collectStep({ ...ctx, session: fresh }, settings)
}

async function continueSlotAppointment(ctx: BotContext, settings: AppointmentSettings) {
  switch (ctx.session.flow_step) {
    case 'picking_day':  return daySelected(ctx, settings)
    case 'picking_slot': return slotSelected(ctx, settings)
    case 'confirming':   return confirmStep(ctx, settings)
    case 'collecting':
    default:             return collectStep(ctx, settings)
  }
}

// ─── Paso 1: recolección conversacional (IA) ─────────────────
async function collectStep(ctx: BotContext, settings: AppointmentSettings) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const history = session.history ?? []
  const tz = settings.timezone

  const now = formatInTimeZone(new Date(), tz, "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es })
  const servicesText = await buildServicesText(clientId, settings)
  const extraText = buildExtraFieldsText(settings)

  const systemPrompt = loadPrompt('prompt-appointment-slots.txt')
    .replace('{COMPANY}', client.company_name ?? 'nuestra empresa')
    .replace('{CURRENTDAY}', now)
    .replaceAll('{SERVICE_LABEL}', settings.service_label)
    .replace('{SERVICES}', servicesText)
    .replace('{EXTRA_FIELDS}', extraText)
    .replace('{HISTORY}', history.map(m => `${m.role}: ${m.content}`).join('\n'))
    .replace('{TOKEN}', SLOTS_READY)

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  const response = await ai.createChat(messages)

  if (!response.includes(SLOTS_READY)) {
    await sendText(pid, token, from, response)
    await appendToHistory(clientId, from, 'assistant', response)
    return
  }

  // Datos completos → extraer estructurado
  const extractMessages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `Extrae los datos de la cita de esta conversación. Hoy es ${now}. Las fechas en zona América/México_City (UTC-6).`,
    },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]
  const data = await ai.extractAppointmentData(extractMessages, {
    serviceLabel: settings.service_label,
    extraFieldKeys: (settings.intake_fields ?? []).map(f => f.key),
  })

  const state: ApptState = {
    name: data.name,
    service: data.service,
    preferred_date: data.preferred_date,
    extra: data.extra ?? {},
  }

  // Sin día válido → seguir preguntando
  if (!data.preferred_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.preferred_date)) {
    const msg = '¿Para qué día te gustaría la cita?'
    await sendText(pid, token, from, msg)
    await appendToHistory(clientId, from, 'assistant', msg)
    await updateSession(clientId, from, { state })
    return
  }

  return presentSlots(ctx, settings, state, data.preferred_date)
}

// ─── Paso 2: mostrar slots del día ───────────────────────────
async function presentSlots(ctx: BotContext, settings: AppointmentSettings, state: ApptState, dayISO: string) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const tz = settings.timezone
  const calendar = getCalendar(client)

  // Día en el pasado → ofrecer próximos días
  if (dayISO < todayISO(tz)) return presentDays(ctx, settings, state, todayISO(tz))

  let slots: Date[]
  try {
    const extraBusy = await getDbBusyForDay(clientId, dayISO, tz)
    slots = await calendar!.getAvailableSlots(dayISO, settings, extraBusy)
  } catch (err) {
    console.error('[InfoBot/Slots] getAvailableSlots failed:', err)
    const msg = 'Ahora mismo no pude consultar la disponibilidad 😕. ¿Lo intentamos de nuevo en un momento?'
    await sendText(pid, token, from, msg)
    await appendToHistory(clientId, from, 'assistant', msg)
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    return
  }

  if (slots.length === 0) return presentDays(ctx, settings, state, dayISO)

  const offered = slots.map(s => s.toISOString())
  const newState: ApptState = { ...state, chosen_day: dayISO, offered_slots: offered }
  await updateSession(clientId, from, { current_flow: 'appointment', flow_step: 'picking_slot', state: newState })

  const body = `Horarios disponibles para *${fmtDay(dayISO)}*. Elige uno:`
  if (slots.length <= 3) {
    await sendButtons(pid, token, from, body, slots.map(s => ({ id: `slot_${s.toISOString()}`, title: fmtTime(s, tz) })))
  } else {
    await sendList(pid, token, from, client.company_name ?? 'Citas', body, 'Ver horarios', [
      { title: 'Horarios', rows: slots.map(s => ({ id: `slot_${s.toISOString()}`, title: fmtTime(s, tz) })) },
    ])
  }
}

// ─── Paso 2b: ofrecer próximos días con disponibilidad ───────
async function presentDays(ctx: BotContext, settings: AppointmentSettings, state: ApptState, fromDayISO: string) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const tz = settings.timezone
  const calendar = getCalendar(client)
  const start = fromDayISO < todayISO(tz) ? todayISO(tz) : fromDayISO

  let days: string[]
  try {
    const extraBusy = await getDbBusyForHorizon(clientId, start, settings)
    days = await calendar!.getNextAvailableDays(start, settings, extraBusy, 8)
  } catch (err) {
    console.error('[InfoBot/Slots] getNextAvailableDays failed:', err)
    const msg = 'Ahora mismo no pude consultar la disponibilidad 😕. ¿Lo intentamos de nuevo en un momento?'
    await sendText(pid, token, from, msg)
    await appendToHistory(clientId, from, 'assistant', msg)
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    return
  }

  if (days.length === 0) {
    const msg = `No tengo horarios disponibles en los próximos ${settings.horizon_days} días. Un asesor te contactará para agendar. 🙏`
    await sendText(pid, token, from, msg)
    await appendToHistory(clientId, from, 'assistant', msg)
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    return
  }

  await updateSession(clientId, from, { current_flow: 'appointment', flow_step: 'picking_day', state })

  const body = 'Esos horarios no están disponibles. Estos son los próximos días con espacio:'
  await sendList(pid, token, from, client.company_name ?? 'Citas', body, 'Ver días', [
    { title: 'Días disponibles', rows: days.map(d => ({ id: `day_${d}`, title: fmtDay(d) })) },
  ])
}

// ─── Paso 3: el paciente elige día ───────────────────────────
async function daySelected(ctx: BotContext, settings: AppointmentSettings) {
  const { text } = ctx
  const state = (ctx.session.state ?? {}) as ApptState
  if (text.startsWith('day_')) {
    return presentSlots(ctx, settings, state, text.slice(4))
  }
  // Texto libre estando en picking_day → re-ofrecer días
  return presentDays(ctx, settings, state, todayISO(settings.timezone))
}

// ─── Paso 4: el paciente elige horario ───────────────────────
async function slotSelected(ctx: BotContext, settings: AppointmentSettings) {
  const { text } = ctx
  const state = (ctx.session.state ?? {}) as ApptState

  // No es un tap de slot, o es una lista vieja (edge #17/#18) → re-listar
  if (!text.startsWith('slot_') || !state.offered_slots?.includes(text.slice(5))) {
    if (state.chosen_day) return presentSlots(ctx, settings, state, state.chosen_day)
    return presentDays(ctx, settings, state, todayISO(settings.timezone))
  }

  const chosen_slot = text.slice(5)
  return presentConfirm(ctx, settings, { ...state, chosen_slot })
}

// ─── Paso 5: resumen + confirmación ──────────────────────────
async function presentConfirm(ctx: BotContext, settings: AppointmentSettings, state: ApptState) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const tz = settings.timezone
  const slotDate = new Date(state.chosen_slot!)

  await updateSession(clientId, from, { current_flow: 'appointment', flow_step: 'confirming', state })

  const extraLines = Object.entries(state.extra ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const field = settings.intake_fields?.find(f => f.key === k)
      return `${field?.label ?? k}: ${v}`
    })

  const summary =
    `Confirma tu cita:\n\n` +
    `👤 ${state.name}\n` +
    `📋 ${settings.service_label}: ${state.service}\n` +
    `📅 ${fmtDay(state.chosen_day!)}\n` +
    `🕐 ${fmtTime(slotDate, tz)} hrs\n` +
    (extraLines.length ? extraLines.map(l => `• ${l}`).join('\n') + '\n' : '') +
    `\n¿Confirmamos?`

  await sendButtons(pid, token, from, summary, [
    { id: 'confirm_yes', title: '✅ Confirmar' },
    { id: 'confirm_change', title: '🕐 Cambiar horario' },
  ])
}

async function confirmStep(ctx: BotContext, settings: AppointmentSettings) {
  const { text, from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token } = client
  const state = (ctx.session.state ?? {}) as ApptState

  if (text === 'confirm_change') {
    if (state.chosen_day) return presentSlots(ctx, settings, state, state.chosen_day)
    return presentDays(ctx, settings, state, todayISO(settings.timezone))
  }
  if (text !== 'confirm_yes') {
    await sendButtons(pid, token, from, 'Por favor confirma o cambia el horario:', [
      { id: 'confirm_yes', title: '✅ Confirmar' },
      { id: 'confirm_change', title: '🕐 Cambiar horario' },
    ])
    return
  }
  return doBooking(ctx, settings, state)
}

// ─── Paso 6: agendar (doble escritura) + confirmación ────────
async function doBooking(ctx: BotContext, settings: AppointmentSettings, state: ApptState) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const tz = settings.timezone
  const slotStart = new Date(state.chosen_slot!)

  const result = await bookAppointment({
    clientId,
    calendar: getCalendar(client),
    settings,
    customerPhone: from,
    customerName: state.name ?? '',
    service: state.service ?? null,
    slotStart,
    extra: state.extra ?? {},
    origin: 'whatsapp',
  })

  if (result.ok) {
    const confirmation =
      `✅ ¡Cita registrada!\n\n` +
      `👤 ${state.name}\n` +
      `📋 ${settings.service_label}: ${state.service}\n` +
      `📅 ${fmtDay(state.chosen_day!)}\n` +
      `🕐 ${fmtTime(slotStart, tz)} hrs\n\n` +
      `Te esperamos. Si necesitas cambios, escríbenos. 🙌`
    await sendText(pid, token, from, confirmation)
    await appendToHistory(clientId, from, 'assistant', confirmation)
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    return
  }

  if (result.reason === 'slot_taken') {
    const msg = 'Uy, ese horario se acaba de ocupar 😅. Aquí están los que siguen disponibles:'
    await sendText(pid, token, from, msg)
    await appendToHistory(clientId, from, 'assistant', msg)
    if (state.chosen_day) return presentSlots(ctx, settings, state, state.chosen_day)
    return presentDays(ctx, settings, state, todayISO(tz))
  }

  const msg = 'Hubo un problema al registrar tu cita 😕. Un asesor te contactará en breve.'
  await sendText(pid, token, from, msg)
  await appendToHistory(clientId, from, 'assistant', msg)
  await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
  await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
}
