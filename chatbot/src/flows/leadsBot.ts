import supabase from '../lib/supabase'
import { Session, updateSession, appendToHistory } from '../lib/session'
import { sendText } from '../lib/whatsapp'
import { ai } from '../services/ai'
import { retrieve } from '../services/rag'
import { ChatCompletionMessageParam } from 'openai/resources/chat'

export interface BotContext {
  text: string
  from: string
  client: any
  session: Session
  botConfig?: any
}

const SYSTEM_PROMPT = `Eres un agente de ventas experto para {COMPANY_NAME}.
Tu objetivo es calificar prospectos de forma conversacional y natural.
Haz preguntas para entender: nombre completo, empresa, necesidad principal, presupuesto aproximado y timeline deseado.
No hagas todas las preguntas de golpe — ve de una en una, de manera natural.
Sé amable, profesional y conciso. No inventes información.
{RAG_CONTEXT}
Historial de la conversación:
{HISTORY}`

export async function handleLeadsBot(ctx: BotContext) {
  const { text, from, client, session } = ctx
  const { wa_phone_number_id: pid, wa_access_token: token, id: clientId } = client
  const history = session.history ?? []

  if (session.flow_step === 'captured') {
    await sendText(pid, token, from,
      'Ya tenemos tu información registrada. Nuestro equipo te contactará pronto. ¡Gracias! 🙏')
    return
  }

  // After enough exchanges, check if ready to capture
  if (history.length >= 6) {
    const readinessMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: 'Evaluate the following conversation and determine if we have enough info to qualify this lead.' },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    const { ready } = await ai.isLeadReady(readinessMessages)
    if (ready) return captureLead(ctx)
  }

  // Continue conversation
  const chunks = await retrieve(text, clientId).catch(() => [] as string[])
  const ragContext = chunks.length > 0
    ? `Información real sobre los servicios de la empresa:\n\n${chunks.join('\n\n')}\n\n`
    : ''

  const basePrompt = ctx.botConfig?.system_prompt || SYSTEM_PROMPT
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

  if (error) console.error('[LeadsBot] Insert error:', error)

  const name = lead.name ? `, ${lead.name}` : ''
  await sendText(pid, token, from,
    `¡Muchas gracias${name}! Hemos registrado tu información y un miembro de nuestro equipo se pondrá en contacto contigo a la brevedad con una propuesta personalizada. 🚀`)

  await updateSession(clientId, from, { current_flow: null, flow_step: 'captured' })
}
