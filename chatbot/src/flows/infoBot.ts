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
  getUpcomingAppointments,
  getAppointmentById,
  cancelAppointment,
  rescheduleAppointment,
  bookAppointment,
  type BookResult,
} from '../lib/appointments'
import { sendMascotGreeting } from '../lib/mascot'
import { BotContext, AppointmentSettings, AppointmentRow } from '../types'

const APPOINTMENT_COMPLETE = 'CITA_CONFIRMADA'

// Palabras (exactas) que sacan al usuario de cualquier flujo y muestran el menú.
const RESET_KEYWORDS = new Set([
  'menu', 'menú', 'inicio', 'hola', 'buenas', 'buenos dias', 'buenos días',
  'hi', 'ola', 'salir', 'cancelar', 'regresar', 'volver', 'menu principal',
])

// Flujo abandonado: si pasan +2h sin actividad, el siguiente mensaje arranca limpio.
const FLOW_TTL_MS = 2 * 60 * 60 * 1000

// Opción "🏠 Menú" para listas y botones de los flujos (id capturado en handleInfoBot).
const MENU_ROW = { id: 'menu_home', title: '🏠 Menú' }
const MENU_BTN = { id: 'menu_home', title: '🏠 Menú' }

function loadPrompt(name: string): string {
  return fs.readFileSync(path.join(__dirname, '..', 'prompts', name), 'utf-8')
}

export async function handleInfoBot(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { id: clientId } = client

  // ¿Flujo de slots habilitado para este cliente? (settings.enabled + Calendar)
  const settings = await getAppointmentSettings(clientId)
  const slotsEnabled = !!(
    settings?.enabled &&
    client.google_calendar_id &&
    client.google_calendar_key_url
  )

  const lower = text.trim().toLowerCase()

  // Salida global al menú (sin IA): palabra clave exacta o la opción "🏠 Menú".
  // Se evalúa ANTES de los guards de flujo → siempre saca al usuario de cualquier flujo.
  if (RESET_KEYWORDS.has(lower) || text === 'menu_home') {
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    console.log('[InfoBot] reset → sending menu')
    return sendInfoMenu(ctx, false)
  }

  // TTL: flujo abandonado (>2h sin actividad) → arrancar limpio en el menú.
  if (session.current_flow && Date.now() - new Date(session.last_message_at).getTime() > FLOW_TTL_MS) {
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    console.log('[InfoBot] flow expired (TTL) → sending menu')
    return sendInfoMenu(ctx, false)
  }

  // ── Flujos activos (deterministas). La IA NO decide routing. ──
  if (session.current_flow === 'appointment') {
    return slotsEnabled
      ? continueSlotAppointment(ctx, settings!)
      : continueAppointmentFlow(ctx)
  }
  if (session.current_flow === 'faq') {
    return runFAQ(ctx)   // única vía donde la IA responde texto libre (con RAG)
  }
  if (session.current_flow === 'manage_appt') {
    return continueManageAppt(ctx, settings, slotsEnabled)
  }

  // Tap de una opción del menú
  if (text.startsWith('menu_')) return routeInfoMenu(ctx, text, settings, slotsEnabled)

  // Cualquier otra cosa fuera de flujo → menú (mascot solo la 1ª vez).
  // Routing 100% por menú: el usuario elige qué hacer tapeando, no por texto libre.
  const isFirstInteraction = (session.history ?? []).length === 0
  console.log(`[InfoBot] no flow → sending menu (first=${isFirstInteraction})`)
  return sendInfoMenu(ctx, isFirstInteraction)
}

// FAQ — única vía donde la IA responde texto libre (con RAG). Se entra desde el menú
// ("Información") y se sale con "menu". No participa en el routing.
async function runFAQ(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const history = session.history ?? []
  const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n')

  const ragContext = await getRagContext(`${text} ${client.company_name ?? ''}`, clientId)
  console.log(`[InfoBot/FAQ] RAG context length=${ragContext.length}`)

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
  offered_services?: string[]   // opciones de servicio ofrecidas (validación)
  chosen_day?: string
  offered_slots?: string[]
  chosen_slot?: string
  reschedule_id?: string        // si está, doBooking reagenda esta cita en vez de crear
  manage_id?: string            // cita seleccionada en el flujo "Mi cita"
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

// ═══════════════════════════════════════════════════════════
// Máquina de estados determinista (sin IA en la recolección).
// IA solo en: primer intent (handleInfoBot) + texto abierto (nombre).
// Orden: nombre → especialidad → campos extra → día → hora → confirmar.
// ═══════════════════════════════════════════════════════════

// ─── Entrada ─────────────────────────────────────────────────
async function startSlotAppointment(ctx: BotContext, settings: AppointmentSettings) {
  const { from, client } = ctx
  await updateSession(client.id, from, { current_flow: 'appointment', flow_step: 'collect_name', state: {} })
  const msg = 'Para agendar tu cita, ¿cuál es tu *nombre completo*? 🙂'
  await sendText(client.wa_phone_number_id!, client.wa_access_token!, from, msg)
  await appendToHistory(client.id, from, 'assistant', msg)
}

async function continueSlotAppointment(ctx: BotContext, settings: AppointmentSettings) {
  switch (ctx.session.flow_step) {
    case 'collect_name':    return onName(ctx, settings)
    case 'collect_service': return onService(ctx, settings)
    case 'picking_day':     return daySelected(ctx, settings)
    case 'picking_slot':    return slotSelected(ctx, settings)
    case 'confirming':      return confirmStep(ctx, settings)
    default:                return startSlotAppointment(ctx, settings)
  }
}

// ─── Paso 1: nombre (único texto abierto) ────────────────────
async function onName(ctx: BotContext, settings: AppointmentSettings) {
  const name = ctx.text.trim()
  return askService(ctx, settings, { name })
}

// ─── Paso 2: especialidad / servicio (List) ──────────────────
async function askService(ctx: BotContext, settings: AppointmentSettings, state: ApptState) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  const names = (await fetchServiceNames(clientId)).slice(0, 9) // 9 + fila Menú = 10 (máx WA)

  // Sin catálogo → fallback a texto abierto
  if (names.length === 0) {
    await updateSession(clientId, from, { current_flow: 'appointment', flow_step: 'collect_service', state })
    const msg = `¿Qué ${settings.service_label.toLowerCase()} necesitas?`
    await sendText(pid!, token!, from, msg)
    return
  }

  const newState: ApptState = { ...state, offered_services: names }
  await updateSession(clientId, from, { current_flow: 'appointment', flow_step: 'collect_service', state: newState })
  await sendList(pid!, token!, from, settings.service_label, 'Elige una opción:', 'Ver opciones', [
    { title: settings.service_label, rows: names.map((n, i) => ({ id: `svc_${i}`, title: n.slice(0, 24) })) },
    { title: ' ', rows: [MENU_ROW] },
  ])
}

async function onService(ctx: BotContext, settings: AppointmentSettings) {
  const { text, from, client } = ctx
  const state = (ctx.session.state ?? {}) as ApptState
  const offered = state.offered_services ?? []

  let service: string | undefined
  if (text.startsWith('svc_')) {
    service = offered[Number(text.slice(4))]
  } else if (offered.length === 0) {
    service = text.trim() // fallback texto abierto
  } else {
    // Escribió en vez de tapear → intentar match, si no re-listar
    service = offered.find(n => n.toLowerCase() === text.trim().toLowerCase())
  }

  if (!service) return askService(ctx, settings, state) // re-listar
  // Servicio listo → directo a elegir día (sin campos extra: bot genérico)
  return presentDays(ctx, settings, { ...state, service }, todayISO(settings.timezone))
}

// ─── Paso 3: mostrar slots del día ───────────────────────────
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
  await sendList(pid, token, from, client.company_name ?? 'Citas', body, 'Ver horarios', [
    { title: 'Horarios', rows: slots.slice(0, 9).map(s => ({ id: `slot_${s.toISOString()}`, title: fmtTime(s, tz) })) },
    { title: ' ', rows: [MENU_ROW] },
  ])
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

  const body = 'Elige el día para tu cita:'
  await sendList(pid, token, from, client.company_name ?? 'Citas', body, 'Ver días', [
    { title: 'Días disponibles', rows: days.slice(0, 9).map(d => ({ id: `day_${d}`, title: fmtDay(d) })) },
    { title: ' ', rows: [MENU_ROW] },
  ])
}

// ─── Paso 4: el cliente elige día ────────────────────────────
async function daySelected(ctx: BotContext, settings: AppointmentSettings) {
  const { text } = ctx
  const state = (ctx.session.state ?? {}) as ApptState
  if (text.startsWith('day_')) {
    return presentSlots(ctx, settings, state, text.slice(4))
  }
  // Texto libre estando en picking_day → re-ofrecer días
  return presentDays(ctx, settings, state, todayISO(settings.timezone))
}

// ─── Paso 5: el cliente elige horario ────────────────────────
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

  const summary =
    `Confirma tu cita:\n\n` +
    `👤 ${state.name}\n` +
    `📋 ${settings.service_label}: ${state.service}\n` +
    `📅 ${fmtDay(state.chosen_day!)}\n` +
    `🕐 ${fmtTime(slotDate, tz)} hrs\n` +
    `\n¿Confirmamos?`

  await sendButtons(pid, token, from, summary, [
    { id: 'confirm_yes', title: '✅ Confirmar' },
    { id: 'confirm_change', title: '🕐 Cambiar horario' },
    MENU_BTN,
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
      MENU_BTN,
    ])
    return
  }
  return doBooking(ctx, settings, state)
}

// ─── Paso 6: agendar / reagendar (doble escritura) + confirmación ────────
async function doBooking(ctx: BotContext, settings: AppointmentSettings, state: ApptState) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const tz = settings.timezone
  const slotStart = new Date(state.chosen_slot!)
  const isReschedule = !!state.reschedule_id

  let result: BookResult
  if (isReschedule) {
    const appt = await getAppointmentById(String(state.reschedule_id))
    result = appt
      ? await rescheduleAppointment(appt, slotStart, settings, getCalendar(client))
      : { ok: false, reason: 'error' }
  } else {
    result = await bookAppointment({
      clientId,
      calendar: getCalendar(client),
      settings,
      customerPhone: from,
      customerName: state.name ?? '',
      service: state.service ?? null,
      slotStart,
      origin: 'whatsapp',
    })
  }

  if (result.ok) {
    const confirmation =
      `✅ ¡Cita ${isReschedule ? 'reagendada' : 'registrada'}!\n\n` +
      `👤 ${state.name}\n` +
      `📋 ${settings.service_label}: ${state.service}\n` +
      `📅 ${fmtDay(state.chosen_day!)}\n` +
      `🕐 ${fmtTime(slotStart, tz)} hrs\n\n` +
      `Te esperamos. Si necesitas cambios, escribe *menu*. 🙌`
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
}

// ═══════════════════════════════════════════════════════════
// SALUDO CON MASCOT + MENÚ (primera interacción del bot informativo)
// ═══════════════════════════════════════════════════════════

async function sendInfoMenu(ctx: BotContext, withMascot: boolean) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId, company_name } = client
  const companyName = company_name ?? 'la empresa'

  // Mascot con imagen — solo la primera vez (withMascot) y si está configurado.
  if (withMascot && client.mascot_name && client.mascot_image_url) {
    const greeting =
      `¡Hola! Mi nombre es *${client.mascot_name}*, el asesor digital de ${companyName}. ` +
      `¿En qué puedo ayudarte el día de hoy?`
    await sendMascotGreeting(client, from, greeting)
    await appendToHistory(clientId, from, 'assistant', greeting)
  }

  await sendList(
    pid!,
    token!,
    from,
    company_name ?? 'Bienvenido',
    'Elige una opción para continuar.',
    'Ver opciones',
    [
      {
        title: 'Opciones',
        rows: [
          { id: 'menu_cita',   title: '📅 Agendar cita',     description: 'Reserva tu cita' },
          { id: 'menu_faq',    title: '❓ Información',        description: 'Preguntas frecuentes' },
          { id: 'menu_micita', title: '🗓️ Mi cita',          description: 'Ver, cambiar o cancelar' },
          { id: 'menu_human',  title: '👤 Hablar con asesor', description: 'Te atiende una persona' },
        ],
      },
    ]
  )
}

async function routeInfoMenu(
  ctx: BotContext,
  optionId: string,
  settings: AppointmentSettings | null,
  slotsEnabled: boolean
) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  console.log(`[InfoBot] menu option tapped: ${optionId}`)

  switch (optionId) {
    case 'menu_cita':
      return slotsEnabled ? startSlotAppointment(ctx, settings!) : startAppointmentFlow(ctx)

    case 'menu_faq': {
      await updateSession(clientId, from, { current_flow: 'faq', flow_step: null, state: {} })
      const msg = '¿Qué te gustaría saber? Escríbeme tu pregunta 💬\n\n(escribe *menu* para volver al menú)'
      await sendText(pid!, token!, from, msg)
      await appendToHistory(clientId, from, 'assistant', msg)
      return
    }

    case 'menu_micita':
      return showMyAppointments(ctx, settings, slotsEnabled)

    case 'menu_human': {
      await updateSession(clientId, from, { human_takeover: true, current_flow: null, flow_step: null, state: {} })
      const msg = 'Te conecto con un asesor. En breve te responde 🙏'
      await sendText(pid!, token!, from, msg)
      await appendToHistory(clientId, from, 'assistant', msg)
      return
    }

    default:
      return sendInfoMenu(ctx, false)
  }
}

// ═══════════════════════════════════════════════════════════
// "Mi cita" — consultar / reagendar / cancelar (flujo determinista)
// ═══════════════════════════════════════════════════════════

function fmtApptWhen(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, "EEEE d 'de' MMMM, HH:mm 'hrs'", { locale: es })
}

// Entrada del menú "Mi cita": muestra la(s) cita(s) próxima(s) con acciones.
async function showMyAppointments(ctx: BotContext, settings: AppointmentSettings | null, slotsEnabled: boolean) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const tz = settings?.timezone ?? 'America/Mexico_City'
  const upcoming = await getUpcomingAppointments(clientId, from)

  if (upcoming.length === 0) {
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    const msg = 'No tienes citas próximas con este número. Para agendar una, escribe *menu* y elige "Agendar cita". 📅'
    await sendText(pid!, token!, from, msg)
    await appendToHistory(clientId, from, 'assistant', msg)
    return
  }

  if (upcoming.length === 1) {
    return presentApptActions(ctx, settings, slotsEnabled, upcoming[0])
  }

  // Varias citas → lista para elegir cuál gestionar
  await updateSession(clientId, from, { current_flow: 'manage_appt', flow_step: 'picking_appt', state: {} })
  await sendList(pid!, token!, from, 'Mis citas', 'Elige la cita que quieres ver:', 'Ver citas', [
    {
      title: 'Próximas citas',
      rows: upcoming.slice(0, 9).map(a => ({
        id: `appt_${a.id}`,
        title: formatInTimeZone(new Date(a.starts_at), tz, "d MMM HH:mm", { locale: es }).slice(0, 24),
        description: a.service ?? undefined,
      })),
    },
    { title: ' ', rows: [MENU_ROW] },
  ])
}

// Muestra una cita + botones de acción.
async function presentApptActions(ctx: BotContext, settings: AppointmentSettings | null, slotsEnabled: boolean, appt: AppointmentRow) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const tz = settings?.timezone ?? 'America/Mexico_City'

  await updateSession(clientId, from, { current_flow: 'manage_appt', flow_step: 'actions', state: { manage_id: appt.id } })

  const body =
    `Tu cita:\n\n` +
    `📋 ${settings?.service_label ?? 'Servicio'}: ${appt.service ?? '—'}\n` +
    `🗓️ ${fmtApptWhen(appt.starts_at, tz)}\n\n` +
    `¿Qué quieres hacer?`

  const buttons = [{ id: `cancel_${appt.id}`, title: '❌ Cancelar' }]
  if (slotsEnabled) buttons.unshift({ id: `resched_${appt.id}`, title: '🕐 Cambiar horario' })
  buttons.push(MENU_BTN)
  await sendButtons(pid!, token!, from, body, buttons)
}

async function continueManageAppt(ctx: BotContext, settings: AppointmentSettings | null, slotsEnabled: boolean) {
  const { text, from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  if (text.startsWith('appt_')) {
    const appt = await getAppointmentById(text.slice(5))
    if (!appt) return showMyAppointments(ctx, settings, slotsEnabled)
    return presentApptActions(ctx, settings, slotsEnabled, appt)
  }

  if (text.startsWith('resched_')) {
    const appt = await getAppointmentById(text.slice(8))
    if (!appt || !settings) return showMyAppointments(ctx, settings, slotsEnabled)
    return startReschedule(ctx, settings, appt)
  }

  if (text.startsWith('cancel_')) {
    const id = text.slice(7)
    await updateSession(clientId, from, { current_flow: 'manage_appt', flow_step: 'confirm_cancel', state: { manage_id: id } })
    await sendButtons(pid!, token!, from, '¿Seguro que quieres cancelar tu cita?', [
      { id: 'cancelyes', title: '✅ Sí, cancelar' },
      { id: 'cancelno', title: '↩️ No' },
    ])
    return
  }

  if (text === 'cancelyes') {
    const state = (ctx.session.state ?? {}) as ApptState
    const appt = state.manage_id ? await getAppointmentById(String(state.manage_id)) : null
    if (appt) await cancelAppointment(appt, getCalendar(client))
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    const msg = appt ? '✅ Tu cita fue cancelada. Si quieres agendar otra, escribe *menu*.' : 'No encontré la cita. Escribe *menu*.'
    await sendText(pid!, token!, from, msg)
    await appendToHistory(clientId, from, 'assistant', msg)
    return
  }

  if (text === 'cancelno') {
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    const msg = 'Listo, no cancelé nada. Escribe *menu* para ver opciones. 🙂'
    await sendText(pid!, token!, from, msg)
    await appendToHistory(clientId, from, 'assistant', msg)
    return
  }

  return showMyAppointments(ctx, settings, slotsEnabled)
}

// Inicia la reagenda reusando el picker de día/hora; marca reschedule_id para que
// doBooking actualice la cita existente en vez de crear una nueva.
async function startReschedule(ctx: BotContext, settings: AppointmentSettings, appt: AppointmentRow) {
  const state: ApptState = {
    reschedule_id: appt.id,
    name: appt.customer_name ?? '',
    service: appt.service ?? undefined,
  }
  return presentDays(ctx, settings, state, todayISO(settings.timezone))
}
