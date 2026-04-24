import { OpenAI } from 'openai'
import { ChatCompletionMessageParam } from 'openai/resources/chat'

class AIService {
  private openai: OpenAI
  private model: string

  constructor() {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing')
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15_000 })
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4o'
  }

  async createChat(messages: ChatCompletionMessageParam[], temperature = 0): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature,
        max_tokens: 512,
      })
      return completion.choices[0].message.content ?? ''
    } catch (err) {
      console.error('[AI] createChat error:', err)
      return ''
    }
  }

  private async callTool<T>(
    messages: ChatCompletionMessageParam[],
    toolName: string,
    toolDef: object,
    fallback: T
  ): Promise<T> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        temperature: 0,
        messages,
        tools: [{ type: 'function', function: { name: toolName, ...toolDef } }],
        tool_choice: { type: 'function', function: { name: toolName } },
      })
      const args = completion.choices[0]?.message?.tool_calls?.[0]?.function?.arguments
      if (!args) throw new Error('No tool args')
      return JSON.parse(args) as T
    } catch (err) {
      console.error(`[AI] ${toolName} error:`, err)
      return fallback
    }
  }

  determineIntent(messages: ChatCompletionMessageParam[]) {
    return this.callTool<{ intent: string }>(
      messages,
      'fn_get_intent',
      {
        description: 'Classify the user intent from the conversation',
        parameters: {
          type: 'object',
          properties: {
            intent: {
              type: 'string',
              enum: ['agendar_cita', 'consultar_empresa', 'hablar'],
            },
          },
          required: ['intent'],
        },
      },
      { intent: 'hablar' }
    )
  }

  determineAppointment(messages: ChatCompletionMessageParam[]) {
    return this.callTool<{
      appointment: { name: string; phone: string; service: string; date: string }
    }>(
      messages,
      'fn_create_appointment',
      {
        description: 'Extract appointment details from conversation',
        parameters: {
          type: 'object',
          properties: {
            appointment: {
              type: 'object',
              properties: {
                name: { type: 'string', description: "Customer's full name" },
                phone: { type: 'string', description: "Customer's phone number" },
                service: { type: 'string', description: 'Service to be booked' },
                date: {
                  type: 'string',
                  format: 'date-time',
                  description:
                    'Appointment date in ISO 8601 format, interpreted as America/Mexico_City (UTC-6)',
                },
              },
              required: ['name', 'phone', 'service', 'date'],
            },
          },
          required: ['appointment'],
        },
      },
      { appointment: { name: '', phone: '', service: '', date: '' } }
    )
  }

  determineLead(messages: ChatCompletionMessageParam[]) {
    return this.callTool<{
      lead: {
        name: string
        company: string
        need: string
        budget_range: string
        timeline: string
      }
    }>(
      messages,
      'fn_capture_lead',
      {
        description: 'Extract lead qualification data from conversation',
        parameters: {
          type: 'object',
          properties: {
            lead: {
              type: 'object',
              properties: {
                name: { type: 'string', description: "Customer's full name" },
                company: { type: 'string', description: "Customer's company" },
                need: { type: 'string', description: 'Main need or problem' },
                budget_range: { type: 'string', description: 'Approximate budget' },
                timeline: { type: 'string', description: 'Desired timeline' },
              },
              required: ['name', 'need'],
            },
          },
          required: ['lead'],
        },
      },
      { lead: { name: '', company: '', need: '', budget_range: '', timeline: '' } }
    )
  }

  isLeadReady(messages: ChatCompletionMessageParam[]) {
    return this.callTool<{ ready: boolean; missing: string }>(
      messages,
      'fn_check_lead_readiness',
      {
        description: 'Check if enough info has been gathered to create a lead record',
        parameters: {
          type: 'object',
          properties: {
            ready: {
              type: 'boolean',
              description: 'True if we have at least name, need, and some budget/timeline info',
            },
            missing: {
              type: 'string',
              description: 'What key info is still missing, empty string if ready',
            },
          },
          required: ['ready', 'missing'],
        },
      },
      { ready: false, missing: 'insufficient data' }
    )
  }

  isOptOutIntent(text: string, history: { role: string; content: string }[]) {
    const context = history.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'Determine if the user explicitly wants to permanently stop receiving messages from this bot. ' +
          'Return false if they are cancelling an order, asking a question, or using opt-out words in a different context. ' +
          'Only return true if the intent is clearly to unsubscribe or stop all bot messages.',
      },
      {
        role: 'user',
        content: context ? `Conversation context:\n${context}\n\nLatest message: ${text}` : text,
      },
    ]
    return this.callTool<{ is_opt_out: boolean }>(
      messages,
      'fn_detect_opt_out',
      {
        description: 'Detect if the user wants to permanently stop receiving messages',
        parameters: {
          type: 'object',
          properties: {
            is_opt_out: {
              type: 'boolean',
              description: 'True only if user clearly wants to unsubscribe from all bot messages',
            },
          },
          required: ['is_opt_out'],
        },
      },
      { is_opt_out: false }
    )
  }

  isOptOutConfirmation(text: string) {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'The user was just asked to confirm they want to stop receiving messages. ' +
          'Determine if their reply is a confirmation (yes) or a rejection (no).',
      },
      { role: 'user', content: text },
    ]
    return this.callTool<{ confirmed: boolean }>(
      messages,
      'fn_confirm_opt_out',
      {
        description: 'Determine if the user confirmed or rejected the opt-out request',
        parameters: {
          type: 'object',
          properties: {
            confirmed: {
              type: 'boolean',
              description: 'True if user said yes/confirmed, false if they said no/rejected',
            },
          },
          required: ['confirmed'],
        },
      },
      { confirmed: false }
    )
  }
}

export const ai = new AIService()
export default ai
