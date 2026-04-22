import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { UserCheck, Bot, RefreshCw, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

const CHATBOT_URL = import.meta.env.VITE_CHATBOT_URL ?? 'http://localhost:4000'

interface Cliente { id: string; company_name: string }

interface HistoryMsg {
  role: 'user' | 'assistant'
  content: string
}

interface Session {
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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export default function Conversaciones() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [stateOpen, setStateOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, company_name')
      .eq('is_active', true)
      .order('company_name')
      .then(({ data }) => {
        const list = data ?? []
        setClientes(list)
        if (list[0]) setClienteId(list[0].id)
      })
  }, [])

  useEffect(() => {
    if (!clienteId) return
    fetchSessions()

    const channel = supabase
      .channel(`conv-${clienteId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_sessions',
        filter: `client_id=eq.${clienteId}`,
      }, () => fetchSessions())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clienteId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.history])

  async function fetchSessions() {
    setLoading(true)
    const { data } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('client_id', clienteId)
      .order('last_message_at', { ascending: false })
    const list = (data ?? []) as Session[]
    setSessions(list)
    if (selected) {
      const updated = list.find(s => s.id === selected.id)
      if (updated) setSelected(updated)
    }
    setLoading(false)
  }

  async function toggleTakeover(session: Session) {
    const next = !session.human_takeover
    await supabase
      .from('conversation_sessions')
      .update({ human_takeover: next })
      .eq('id', session.id)
    fetchSessions()
  }

  async function toggleBotForUser(session: Session) {
    await supabase
      .from('conversation_sessions')
      .update({ bot_disabled_for_user: !session.bot_disabled_for_user })
      .eq('id', session.id)
    fetchSessions()
  }

  async function handleSendReply() {
    if (!replyText.trim() || !selected) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(`${CHATBOT_URL}/bots/${clienteId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: selected.phone_number, message: replyText.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setReplyText('')
      fetchSessions()
    } catch (err: any) {
      setSendError(err?.message ?? 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  const cutoff = Date.now() - SEVEN_DAYS_MS
  const visibleSessions = showAll
    ? sessions
    : sessions.filter(s => new Date(s.last_message_at).getTime() > cutoff)

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Panel izquierdo */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Select value={clienteId} onValueChange={v => { setClienteId(v); setSelected(null) }}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchSessions} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>

        <div className="flex items-center gap-2 px-1">
          <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
          <Label htmlFor="show-all" className="text-xs text-muted-foreground cursor-pointer">
            Mostrar todas
          </Label>
        </div>

        <div className="flex-1 rounded-lg border bg-card overflow-y-auto">
          {visibleSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
              <MessageSquare size={28} className="mb-2 opacity-30" />
              {showAll ? 'Sin conversaciones' : 'Sin actividad en 7 días'}
            </div>
          ) : visibleSessions.map(s => (
            <button
              key={s.id}
              onClick={() => { setSelected(s); setStateOpen(false) }}
              className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors ${selected?.id === s.id ? 'bg-muted' : ''}`}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-sm font-medium truncate">{s.phone_number}</span>
                {s.human_takeover && <UserCheck size={12} className="text-amber-500 shrink-0" />}
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs text-muted-foreground truncate">
                  {s.current_flow ?? 'Sin flujo'}{s.flow_step ? ` · ${s.flow_step}` : ''}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(s.last_message_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 rounded-lg border bg-card flex flex-col min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
            <MessageSquare size={40} className="mb-3 opacity-20" />
            <p className="text-sm">Selecciona una conversación</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <div>
                <p className="font-medium">{selected.phone_number}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {selected.current_flow && (
                    <Badge variant="secondary" className="text-xs">
                      {selected.current_flow}{selected.flow_step ? ` · ${selected.flow_step}` : ''}
                    </Badge>
                  )}
                  {selected.human_takeover && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Takeover activo</Badge>
                  )}
                  {selected.bot_disabled_for_user && (
                    <Badge variant="outline" className="text-xs text-red-500 border-red-300">Bot desactivado</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={selected.bot_disabled_for_user ? 'default' : 'outline'} onClick={() => toggleBotForUser(selected)} className="text-xs">
                  <Bot size={13} className="mr-1.5" />
                  {selected.bot_disabled_for_user ? 'Reactivar bot' : 'Silenciar bot'}
                </Button>
                <Button size="sm" variant={selected.human_takeover ? 'default' : 'outline'} onClick={() => toggleTakeover(selected)} className="text-xs">
                  <UserCheck size={13} className="mr-1.5" />
                  {selected.human_takeover ? 'Devolver al bot' : 'Tomar conversación'}
                </Button>
              </div>
            </div>

            {/* Chat history */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {(!selected.history || selected.history.length === 0) ? (
                <p className="text-center text-sm text-muted-foreground py-8">Sin mensajes en el historial.</p>
              ) : selected.history.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${msg.role === 'user' ? 'bg-muted text-foreground rounded-tl-sm' : 'bg-primary text-primary-foreground rounded-tr-sm'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Session state panel */}
            {selected.state && Object.keys(selected.state).length > 0 && (
              <div className="border-t shrink-0">
                <button
                  onClick={() => setStateOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>Estado de sesión (debug)</span>
                  {stateOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {stateOpen && (
                  <pre className="px-4 pb-3 text-xs font-mono text-foreground overflow-x-auto max-h-40 bg-muted/30">
                    {JSON.stringify(selected.state, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {/* Reply input — solo en takeover */}
            {selected.human_takeover && (
              <div className="px-4 py-3 border-t shrink-0">
                {sendError && (
                  <p className="text-xs text-destructive mb-2">{sendError}</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply() } }}
                    placeholder="Escribe una respuesta... (Enter para enviar)"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button onClick={handleSendReply} disabled={!replyText.trim() || sending}>
                    {sending ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
