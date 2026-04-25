import supabase from '../lib/supabase'
import { updateSession, appendToHistory } from '../lib/session'
import { sendText } from '../lib/whatsapp'
import { ai } from '../services/ai'
import { getRagContext } from '../services/rag'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { BotContext } from '../types'

const LEAD_LISTO = 'LEAD_LISTO'

const TOKEN_INSTRUCTION = `\nCuando hayas recolectado: nombre completo, empresa, necesidad principal, presupuesto aproximado y timeline — muestra un breve resumen de lo recolectado e incluye el token exacto ${LEAD_LISTO} al final de tu mensaje. No lo incluyas antes de tener todos los campos.`

const SYSTEM_PROMPT = `Eres un agente de ventas experto para {COMPANY_NAME}.
Tu objetivo es calificar prospectos de forma conversacional y natural.
Haz preguntas para entender: nombre completo, empresa, necesidad principal, presupuesto aproximado y timeline deseado.
No hagas todas las preguntas de golpe — ve de una en una, de manera natural.
Sé amable, profesional y conciso. No inventes información.
{RAG_CONTEXT}
Historial de la conversación:
{HISTORY}
${TOKEN_INSTRUCTION}`

export async function handleLeadsBot(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const history = session.history ?? []

  console.log(`[LeadsBot] from=${from} flow_step=${session.flow_step ?? 'qualifying'} history=${history.length}`)

  if (session.flow_step === 'captured') {
    await sendText(pid, token, from,
      'Ya tenemos tu información registrada. Nuestro equipo te contactará pronto. ¡Gracias! 🙏')
    return
  }

  // Continue conversation
  const ragQuery = `${text} ${client.company_name ?? ''}`
  const ragContext = await getRagContext(ragQuery, clientId, 'Información real sobre los servicios de la empresa:')

  const basePrompt = (ctx.botConfig?.system_prompt
    ? ctx.botConfig.system_prompt + TOKEN_INSTRUCTION
    : SYSTEM_PROMPT)

  const systemPrompt = basePrompt
    .replace('{COMPANY_NAME}', client.company_name ?? '')
    .replace('{RAG_CONTEXT}', ragContext)
    .replace('{HISTORY}', history.map(m => `${m.role}: ${m.content}`).join('\n'))

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: text },
  ]

  const response = await ai.createChat(messages, 0.3)

  if (response.includes(LEAD_LISTO)) {
    console.log(`[LeadsBot] LEAD_LISTO token detected — capturing lead for ${from}`)
    return captureLead(ctx)
  }

  if (response) {
    await sendText(pid, token, from, response)
    await appendToHistory(clientId, from, 'assistant', response)
  }

  await updateSession(clientId, from, {
    current_flow: 'leads_qualification',
    flow_step: 'qualifying',
  })
}

async function captureLead(ctx: BotContext) {
  const { from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const history = session.history ?? []

  const messages: ChatCompletionMessageParam[] = history.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const { lead } = await ai.determineLead(messages)

  const { error } = await supabase.from('leads').insert({
    client_id: clientId,
    customer_name: lead.name || 'Sin nombre',
    customer_phone: from,
    company: lead.company || null,
    need: lead.need || null,
    budget_range: lead.budget_range || null,
    timeline: lead.timeline || null,
    raw_conversation: history,
    status: 'new',
  })

  if (error) {
    console.error('[LeadsBot] Lead insert error:', error)
  } else {
    console.log(`[LeadsBot] Lead saved for ${from} name="${lead.name}" need="${lead.need}"`)
  }

  const name = lead.name ? `, ${lead.name}` : ''
  await sendText(pid, token, from,
    `¡Muchas gracias${name}! Hemos registrado tu información y un miembro de nuestro equipo se pondrá en contacto contigo a la brevedad con una propuesta personalizada. 🚀`)

  await updateSession(clientId, from, { current_flow: null, flow_step: 'captured' })
}
