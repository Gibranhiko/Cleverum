import supabase from './supabase'

export interface HistoryMsg {
  role: 'user' | 'assistant'
  content: string
}

export interface Session {
  id: string
  client_id: string
  phone_number: string
  current_flow: string | null
  flow_step: string | null
  state: Record<string, unknown>
  history: HistoryMsg[]
  bot_disabled_for_user: boolean
  human_takeover: boolean
  last_message_at: string
}

// In-memory cache: key = `clientId:phone`
const cache = new Map<string, { session: Session; expires: number }>()
const TTL = 5 * 60 * 1000

function key(clientId: string, phone: string) {
  return `${clientId}:${phone}`
}

export async function getSession(clientId: string, phone: string): Promise<Session> {
  const k = key(clientId, phone)
  const cached = cache.get(k)
  if (cached && cached.expires > Date.now()) return cached.session

  const { data, error } = await supabase
    .from('conversation_sessions')
    .upsert(
      { client_id: clientId, phone_number: phone, last_message_at: new Date().toISOString() },
      { onConflict: 'client_id,phone_number', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error || !data) {
    console.error('[Session] upsert error:', error)
    return {
      id: '',
      client_id: clientId,
      phone_number: phone,
      current_flow: null,
      flow_step: null,
      state: {},
      history: [],
      bot_disabled_for_user: false,
      human_takeover: false,
      last_message_at: new Date().toISOString(),
    }
  }

  const session = data as Session
  cache.set(k, { session, expires: Date.now() + TTL })
  return session
}

export async function updateSession(clientId: string, phone: string, updates: Partial<Session>) {
  const k = key(clientId, phone)
  cache.delete(k)

  await supabase
    .from('conversation_sessions')
    .update({ ...updates, last_message_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('phone_number', phone)
}

export async function appendToHistory(
  clientId: string,
  phone: string,
  role: 'user' | 'assistant',
  content: string
) {
  const session = await getSession(clientId, phone)
  const MAX = 10
  const history = [...(session.history ?? []), { role, content }].slice(-MAX)
  await updateSession(clientId, phone, { history })
}

export async function resetFlow(clientId: string, phone: string) {
  await updateSession(clientId, phone, {
    current_flow: null,
    flow_step: null,
    state: {},
  })
}
