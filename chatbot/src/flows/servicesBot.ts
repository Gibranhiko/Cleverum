import fs from 'fs'
import path from 'path'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { updateSession, appendToHistory } from '../lib/session'
import { sendList, sendText, sendButtons, sendImage } from '../lib/whatsapp'
import { createTicket, IntakeData, getTicketByFolio, formatTicketStatus } from '../lib/tickets'
import { BotContext, ServiceRow } from '../types'
import { ai } from '../services/ai'
import { getRagContext } from '../services/rag'
import supabase from '../lib/supabase'

function loadPrompt(name: string): string {
  return fs.readFileSync(path.join(__dirname, '..', 'prompts', name), 'utf-8')
}

// Strict: el texto entero (trimeado) debe ser el folio para evitar matches
// dentro de oraciones tipo "Mi PC-1 no enciende" (BOT-02).
// Soporta dos formatos:
//   - Nuevo: PREFIX + 6 chars alfanuméricos (ej: DTRX7K9P2)
//   - Legacy: PREFIX-N (ej: DTR-1) — para tickets creados antes del cambio
const FOLIO_REGEX = /^[A-Z]{2,5}(?:-\d+|[A-Z0-9]{6})$/i

const DEVICE_TYPES = ['Celular', 'Computadora', 'Laptop', 'Tablet', 'Otro']
const BRANDS = ['Apple', 'Samsung', 'Huawei', 'Xiaomi', 'HP', 'Lenovo', 'Dell', 'Otra']

const YES_WORDS = ['intake_confirm:yes', 'si', 'sí', 'yes', 'ok', 'okay', 'correcto', 'confirmo', 'dale']
const MODIFY_WORDS = ['intake_confirm:modify', 'no', 'modificar', 'cambiar', 'editar']

function isYesText(text: string): boolean {
  return YES_WORDS.includes(text.trim().toLowerCase())
}

function isModifyText(text: string): boolean {
  return MODIFY_WORDS.includes(text.trim().toLowerCase())
}

interface IntakeState extends Record<string, unknown> {
  device_type?: string
  device_brand?: string
  device_model?: string
  problem_description?: string
  problem_category?: string
  customer_name?: string
}

export async function handleServicesBot(ctx: BotContext) {
  const { text, from, session } = ctx
  const flow = session.current_flow ?? null

  console.log(`[ServicesBot] from=${from} flow=${flow} step=${session.flow_step ?? '-'} text="${text.slice(0, 60)}"`)

  // 0. Comando global "menu" — siempre regresa al menú principal,
  // sin importar el flow actual. Determinístico, sin AI.
  if (flow !== 'intake' && text.trim().toLowerCase() === 'menu') {
    console.log(`[ServicesBot] global menu command — returning to main menu`)
    return sendMainMenu(ctx)
  }

  // 1. Folio detection — works from anywhere except mid-intake.
  // Strict match: el texto entero (trimeado) debe ser el folio.
  if (flow !== 'intake' && FOLIO_REGEX.test(text.trim())) {
    console.log(`[ServicesBot] folio detected — routing to status query`)
    return handleStatusQuery(ctx, text)
  }

  // 2a. Tap en un servicio del listado → enviar detalle
  if (text.startsWith('service:')) {
    return sendServiceDetail(ctx, text.split(':')[1])
  }

  // 2b. Acciones de los buttons del detalle
  if (text.startsWith('service_detail:')) {
    return handleServiceDetailAction(ctx, text)
  }

  // 2. Menu option taps (interactive ids start with menu_)
  if (text.startsWith('menu_')) {
    return routeMenuOption(ctx, text)
  }

  // 3. Active flow — delegate to flow handler
  if (flow === 'intake') {
    return handleIntakeStep(ctx)
  }
  if (flow === 'status') {
    return handleStatusQuery(ctx, text)
  }
  if (flow === 'faq') {
    if (text.trim().toLowerCase() === 'menu') return sendMainMenu(ctx)
    return runFAQ(ctx)
  }

  // 4. No flow → classify intent and route
  return routeFreeText(ctx)
}

async function routeFreeText(ctx: BotContext) {
  const { text, session } = ctx
  const history = session.history ?? []
  const { intent } = await ai.getServicesIntent(text, history)
  console.log(`[ServicesBot] free-text intent="${intent}"`)

  switch (intent) {
    case 'levantar_orden':    return startIntake(ctx)
    case 'consultar_orden':   return promptForFolio(ctx)
    case 'ver_servicios':     return sendServicesList(ctx)
    case 'consultar_empresa': return startFAQ(ctx)
    case 'hablar_humano':     return startHumanTakeover(ctx)
    case 'saludo':
    default:                  return sendMainMenu(ctx)
  }
}

async function promptForFolio(ctx: BotContext) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  await updateSession(clientId, from, { current_flow: 'status', flow_step: 'awaiting_folio', state: {} })
  await sendText(pid, token, from, 'Escribe el folio de tu orden (ej: ABCD2K9P)')
}

async function startFAQ(ctx: BotContext) {
  const { from, client } = ctx
  const { id: clientId } = client
  await updateSession(clientId, from, { current_flow: 'faq', flow_step: null, state: {} })
  return runFAQ(ctx)
}

async function startHumanTakeover(ctx: BotContext) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  await updateSession(clientId, from, { human_takeover: true, current_flow: null, flow_step: null, state: {} })
  await sendText(pid, token, from, 'Te conecto con un asesor humano. En breve te responde 🙏')
}

// ─── Main menu ───────────────────────────────────────────────

async function sendMainMenu(ctx: BotContext) {
  const { from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId, company_name } = client

  // Mascot greeting — solo en primera interacción del cliente final.
  // Si después se quiere extender a "primera vez del día", chequear `last_message_at`.
  const isFirstInteraction = (session.history ?? []).length === 0
  if (isFirstInteraction && client.mascot_name && client.mascot_image_url) {
    const greeting =
      `¡Hola! 👋 Mi nombre es *${client.mascot_name}*, el asesor digital de ${company_name ?? 'la empresa'}. ` +
      `¿En qué puedo ayudarte el día de hoy?`
    await sendImage(pid, token, from, client.mascot_image_url, greeting)
    await appendToHistory(clientId, from, 'assistant', greeting)
  }

  await sendList(
    pid,
    token,
    from,
    company_name ?? 'Bienvenido',
    '¿En qué te puedo ayudar?',
    'Ver opciones',
    [
      {
        title: 'Servicios',
        rows: [
          { id: 'menu_intake',   title: '🔧 Levantar orden',     description: 'Trae tu equipo a reparación' },
          { id: 'menu_status',   title: '📦 Consultar mi orden', description: 'Estado por folio' },
          { id: 'menu_services', title: '💰 Servicios y precios', description: 'Lo que ofrecemos' },
        ],
      },
      {
        title: 'Información',
        rows: [
          { id: 'menu_faq',   title: '❓ Preguntas frecuentes', description: 'Resolvemos tus dudas' },
          { id: 'menu_human', title: '👤 Hablar con asesor',     description: 'Te conectamos con una persona' },
        ],
      },
    ]
  )

  await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
}

async function routeMenuOption(ctx: BotContext, optionId: string) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  console.log(`[ServicesBot] menu option tapped: ${optionId}`)

  switch (optionId) {
    case 'menu_intake':
      return startIntake(ctx)

    case 'menu_status': {
      await updateSession(clientId, from, { current_flow: 'status', flow_step: 'awaiting_folio', state: {} })
      const msg = 'Escribe el folio de tu orden (ej: ABCD2K9P)'
      await sendText(pid, token, from, msg)
      await appendToHistory(clientId, from, 'assistant', msg)
      return
    }

    case 'menu_services':
      return sendServicesList(ctx)

    case 'menu_faq': {
      await updateSession(clientId, from, { current_flow: 'faq', flow_step: null, state: {} })
      const msg = '¿Qué quieres saber? Puedes preguntar libremente. Escribe *menu* para volver.'
      await sendText(pid, token, from, msg)
      await appendToHistory(clientId, from, 'assistant', msg)
      return
    }

    case 'menu_human':
      return startHumanTakeover(ctx)

    default:
      console.warn(`[ServicesBot] unknown menu option: ${optionId}`)
      return sendMainMenu(ctx)
  }
}

// ─── Intake flow ─────────────────────────────────────────────

async function startIntake(ctx: BotContext) {
  const { from, client } = ctx
  const { id: clientId } = client
  await updateSession(clientId, from, {
    current_flow: 'intake',
    flow_step: 'awaiting_device_type',
    state: {},
  })
  return promptDeviceType(ctx)
}

async function promptDeviceType(ctx: BotContext) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token } = client

  await sendList(
    pid, token, from,
    'Levantar orden',
    'Cuéntame, ¿qué tipo de equipo nos traes?',
    'Elegir',
    [{
      title: 'Tipos de equipo',
      rows: DEVICE_TYPES.map(t => ({ id: `intake_device:${t}`, title: t })),
    }]
  )
}

async function promptDeviceBrand(ctx: BotContext) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token } = client

  await sendList(
    pid, token, from,
    'Marca',
    '¿De qué marca es?',
    'Elegir',
    [{
      title: 'Marcas',
      rows: BRANDS.map(b => ({ id: `intake_brand:${b}`, title: b })),
    }]
  )
}

async function promptModel(ctx: BotContext) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const msg = '¿Cuál es el modelo? (ej: iPhone 13, Galaxy S22, ThinkPad T14)'
  await sendText(pid, token, from, msg)
  await appendToHistory(clientId, from, 'assistant', msg)
}

async function promptProblem(ctx: BotContext) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const msg = 'Cuéntame qué le pasa al equipo (con el detalle que puedas)'
  await sendText(pid, token, from, msg)
  await appendToHistory(clientId, from, 'assistant', msg)
}

async function promptName(ctx: BotContext) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const msg = '¿Cuál es tu nombre completo?'
  await sendText(pid, token, from, msg)
  await appendToHistory(clientId, from, 'assistant', msg)
}

async function promptConfirm(ctx: BotContext, state: IntakeState) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token } = client

  const summary = [
    '📋 *Resumen de tu orden*',
    `• Equipo: ${state.device_type ?? '—'}`,
    `• Marca: ${state.device_brand ?? '—'}`,
    `• Modelo: ${state.device_model ?? '—'}`,
    `• Problema: ${state.problem_description ?? '—'}`,
    `• Cliente: ${state.customer_name ?? '—'}`,
    '',
    '¿Es correcto?',
  ].join('\n')

  await sendButtons(pid, token, from, summary, [
    { id: 'intake_confirm:yes',    title: '✅ Crear orden' },
    { id: 'intake_confirm:modify', title: '✏️ Modificar' },
  ])
}

async function handleIntakeStep(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const step = session.flow_step
  const state = (session.state ?? {}) as IntakeState

  switch (step) {
    case 'awaiting_device_type': {
      if (!text.startsWith('intake_device:')) {
        await sendText(pid, token, from, 'Por favor elige una opción de la lista.')
        return promptDeviceType(ctx)
      }
      const value = text.split(':')[1]
      if (!DEVICE_TYPES.includes(value)) return promptDeviceType(ctx)
      await updateSession(clientId, from, {
        flow_step: 'awaiting_device_brand',
        state: { ...state, device_type: value },
      })
      return promptDeviceBrand(ctx)
    }

    case 'awaiting_device_brand': {
      if (!text.startsWith('intake_brand:')) {
        await sendText(pid, token, from, 'Por favor elige una opción de la lista.')
        return promptDeviceBrand(ctx)
      }
      const value = text.split(':')[1]
      if (!BRANDS.includes(value)) return promptDeviceBrand(ctx)
      await updateSession(clientId, from, {
        flow_step: 'awaiting_device_model',
        state: { ...state, device_brand: value },
      })
      return promptModel(ctx)
    }

    case 'awaiting_device_model': {
      const value = text.trim()
      if (value.length < 1) return promptModel(ctx)
      await updateSession(clientId, from, {
        flow_step: 'awaiting_problem',
        state: { ...state, device_model: value },
      })
      return promptProblem(ctx)
    }

    case 'awaiting_problem': {
      const value = text.trim()
      if (value.length < 3) {
        await sendText(pid, token, from, 'Cuéntame con un poco más de detalle.')
        return
      }
      const { category } = await ai.classifyProblem(value)
      // TODO Fase 2: photo step (requires webhook to forward image messages)
      await updateSession(clientId, from, {
        flow_step: 'awaiting_name',
        state: { ...state, problem_description: value, problem_category: category },
      })
      return promptName(ctx)
    }

    case 'awaiting_name': {
      const value = text.trim()
      if (value.length < 2) {
        await sendText(pid, token, from, 'Por favor escribe tu nombre completo.')
        return
      }
      const newState: IntakeState = { ...state, customer_name: value }
      await updateSession(clientId, from, {
        flow_step: 'awaiting_confirm',
        state: newState,
      })
      return promptConfirm(ctx, newState)
    }

    case 'awaiting_confirm': {
      if (isYesText(text)) {
        return finalizeIntake(ctx, state)
      }
      if (isModifyText(text)) {
        // Reset completo: WhatsApp Lists no soportan default selection,
        // así que es más simple repetir todo el flow.
        await updateSession(clientId, from, {
          flow_step: 'awaiting_device_type',
          state: {},
        })
        await sendText(pid, token, from, 'Sin problema, comencemos de nuevo desde el principio.')
        return promptDeviceType(ctx)
      }
      // Invalid input — explicar y re-mostrar confirm
      await sendText(pid, token, from,
        'No entendí. Tap un botón o escribe *sí* para crear la orden o *no* para modificar.'
      )
      return promptConfirm(ctx, state)
    }

    default:
      console.warn(`[ServicesBot] unknown intake step: ${step} — restarting`)
      return startIntake(ctx)
  }
}

async function finalizeIntake(ctx: BotContext, state: IntakeState) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  const intake: IntakeData = {
    customer_phone: from,
    customer_name: state.customer_name,
    device_type: state.device_type,
    device_brand: state.device_brand,
    device_model: state.device_model,
    problem_description: state.problem_description,
    problem_category: state.problem_category,
  }

  const result = await createTicket(client, intake)

  if (!result) {
    await sendText(pid, token, from, '😕 Tuvimos un problema creando tu orden. Por favor intenta de nuevo o pide hablar con un asesor.')
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    return
  }

  const message = [
    `✅ *¡Tu orden ha sido registrada!*`,
    '',
    `📋 Folio: *${result.folio}*`,
    '',
    `📌 *Guarda este folio.* Lo necesitas para:`,
    `• Consultar el estado de tu reparación`,
    `• Recoger tu equipo cuando esté listo`,
    '',
    `Te avisaremos por aquí mismo en cuanto tengamos novedades.`,
  ].join('\n')

  await sendText(pid, token, from, message)
  await appendToHistory(clientId, from, 'assistant', message)
  await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
}

// ─── Status query (B-05) ─────────────────────────────────────

async function handleStatusQuery(ctx: BotContext, text: string) {
  const { from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  const trimmed = text.trim()

  // BOT-05: validar formato de folio antes de query.
  // Si el flow es awaiting_folio (user vino del menú), input inválido → re-prompt
  // sin cerrar el flow. Si folio fue detectado por regex en otro contexto, ya
  // está validado en handleServicesBot.
  if (session.flow_step === 'awaiting_folio' && !FOLIO_REGEX.test(trimmed)) {
    await sendText(pid, token, from,
      'Formato no válido. El folio debe ser similar a *ABCD2K9P*. Inténtalo de nuevo o escribe *menu* para ver opciones.'
    )
    return // mantener flow_step en awaiting_folio
  }

  const folio = trimmed.toUpperCase()

  console.log(`[ServicesBot] status query — extracted folio="${folio}"`)
  const ticket = await getTicketByFolio(clientId, folio)

  // Security: mismo mensaje si el folio no existe O pertenece a otro número.
  // Mensajes distintos permiten enumerar tickets de otros clientes finales.
  if (!ticket || ticket.customer_phone !== from) {
    if (ticket && ticket.customer_phone !== from) {
      console.warn(`[ServicesBot] folio ${folio} access denied — phone mismatch`)
    }
    await sendText(pid, token, from,
      `No encontré la orden *${folio}*. Verifica el folio o escribe *menu* para ver opciones.`
    )
    await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
    return
  }

  const message = formatTicketStatus(ticket)
  await sendText(pid, token, from, message)
  await appendToHistory(clientId, from, 'assistant', message)
  await updateSession(clientId, from, { current_flow: null, flow_step: null, state: {} })
}

// ─── Services list (B-06) ────────────────────────────────────

const WA_LIST_MAX_TOTAL_ROWS = 10
const WA_TITLE_MAX = 24
const WA_DESC_MAX = 72

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function formatPrice(s: ServiceRow): string {
  if (s.price_label) return s.price_label
  if (s.price_amount != null) return `$${s.price_amount}`
  return ''
}

async function sendServicesList(ctx: BotContext) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('[ServicesBot] services query error:', error)
    await sendText(pid, token, from, 'Tuve un problema cargando los servicios. Intenta de nuevo en un momento.')
    return
  }

  const services = (data ?? []) as ServiceRow[]

  if (services.length === 0) {
    await sendText(pid, token, from,
      'Aún no tenemos servicios cargados. Pregunta directo a un asesor o escribe *menu* para otras opciones.'
    )
    return
  }

  // Group by category — services without category go to "Otros"
  const groups = new Map<string, ServiceRow[]>()
  for (const svc of services.slice(0, WA_LIST_MAX_TOTAL_ROWS)) {
    const cat = (svc.category ?? '').trim() || 'Otros'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(svc)
  }

  const sections = Array.from(groups.entries()).map(([category, items]) => ({
    title: truncate(category, WA_TITLE_MAX),
    rows: items.map(svc => ({
      id: `service:${svc.id}`,
      title: truncate(svc.name, WA_TITLE_MAX),
      description: truncate(formatPrice(svc) || svc.description || '', WA_DESC_MAX) || undefined,
    })),
  }))

  const footer = services.length > WA_LIST_MAX_TOTAL_ROWS
    ? `Mostrando ${WA_LIST_MAX_TOTAL_ROWS} de ${services.length} servicios. Pregunta por uno específico para más detalles.`
    : '¿Tienes alguna duda? Escribe *menu* para ver más opciones.'

  await sendList(
    pid, token, from,
    'Servicios y precios',
    footer,
    'Ver lista',
    sections
  )
}

// ─── Service detail (tap en un row del listado) ──────────────

async function sendServiceDetail(ctx: BotContext, serviceId: string) {
  const { from, client } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .eq('client_id', clientId) // security: solo del propio cliente
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) {
    console.warn(`[ServicesBot] service detail not found id=${serviceId}`)
    await sendText(pid, token, from,
      'Ese servicio ya no está disponible. Escribe *menu* para ver otras opciones.'
    )
    return
  }

  const service = data as ServiceRow
  const lines: string[] = []
  lines.push(`*${service.name}*`)
  if (service.description) {
    lines.push('')
    lines.push(service.description)
  }

  const priceText = service.price_label
    || (service.price_amount != null ? `$${service.price_amount}` : null)
  if (priceText) {
    lines.push('')
    lines.push(`💵 ${priceText}`)
  }
  if (service.estimated_duration) {
    lines.push(`⏱️ ${service.estimated_duration}`)
  }
  if (service.examples) {
    lines.push('')
    lines.push(`📋 *Ejemplos:*`)
    lines.push(service.examples)
  }

  let message = lines.join('\n')
  // WhatsApp caption limit es 1024 chars cuando hay imagen, 4096 sin imagen
  const maxLen = service.image_url ? 1024 : 4096
  if (message.length > maxLen) {
    message = message.slice(0, maxLen - 3) + '...'
  }

  if (service.image_url) {
    await sendImage(pid, token, from, service.image_url, message)
  } else {
    await sendText(pid, token, from, message)
  }
  await appendToHistory(clientId, from, 'assistant', message)

  // Buttons de acción
  await sendButtons(pid, token, from, '¿Qué quieres hacer?', [
    { id: 'service_detail:start_intake', title: '🔧 Levantar orden' },
    { id: 'service_detail:back_to_services', title: '⬅️ Más servicios' },
  ])
}

async function handleServiceDetailAction(ctx: BotContext, action: string) {
  if (action === 'service_detail:back_to_services') {
    return sendServicesList(ctx)
  }
  if (action.startsWith('service_detail:start_intake')) {
    return startIntake(ctx)
  }
  console.warn(`[ServicesBot] unknown service detail action: ${action}`)
  return sendMainMenu(ctx)
}

// ─── FAQ (B-07) ──────────────────────────────────────────────

async function runFAQ(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const history = session.history ?? []

  const ragQuery = `${text} ${client.company_name ?? ''}`
  const ragContext = await getRagContext(ragQuery, clientId)
  console.log(`[ServicesBot/FAQ] RAG context length=${ragContext.length}`)

  const basePrompt = ctx.botConfig?.system_prompt || loadPrompt('prompt-talker.txt')
  const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n')

  const talker = basePrompt
    .replace('{BUSINESSDATA.companyName}',    client.company_name ?? '')
    .replace('{BUSINESSDATA.companyAddress}', client.company_address ?? '')
    .replace('{BUSINESSDATA.whatsappPhone}',  client.whatsapp_phone ?? '')
    .replace('{BUSINESSDATA.companyEmail}',   client.company_email ?? '')
    .replace('{BUSINESSDATA.facebookLink}',   client.facebook_link ?? '')
    .replace('{BUSINESSDATA.instagramLink}',  client.instagram_link ?? '')
    .replace('{HISTORY}',                     historyText)
    .replace('{RAG_CONTEXT}',                 ragContext)

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: talker },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: text },
  ]

  const response = await ai.createChat(messages)
  if (response) {
    await sendText(pid, token, from, response)
    await appendToHistory(clientId, from, 'assistant', response)
  }
}
