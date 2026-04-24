import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserCheck, Bot, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { CHATBOT_URL, chatbotHeaders } from '@/lib/config'

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

interface ChatPanelProps {
  session: Session
  clienteId: string
  onToggleTakeover: (session: Session) => void
  onToggleBotForUser: (session: Session) => void
  onMessageSent?: () => void
}

export default function ChatPanel({ session, clienteId, onToggleTakeover, onToggleBotForUser, onMessageSent }: ChatPanelProps) {
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [stateOpen, setStateOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.history])

  async function handleSendReply() {
    if (!replyText.trim()) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(`${CHATBOT_URL}/bots/${clienteId}/send`, {
        method: 'POST',
        headers: chatbotHeaders,
        body: JSON.stringify({ phone_number: session.phone_number, message: replyText.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setReplyText('')
      onMessageSent?.()
    } catch (err: any) {
      const msg = err?.message ?? 'Error al enviar'
      setSendError(msg)
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div>
          <p className="font-medium">{session.phone_number}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {session.current_flow && (
              <Badge variant="secondary" className="text-xs">
                {session.current_flow}{session.flow_step ? ` · ${session.flow_step}` : ''}
              </Badge>
            )}
            {session.human_takeover && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Takeover activo</Badge>
            )}
            {session.bot_disabled_for_user && (
              <Badge variant="outline" className="text-xs text-red-600 border-red-300">Bot desactivado</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={session.bot_disabled_for_user ? 'default' : 'outline'} aria-label={session.bot_disabled_for_user ? 'Reactivar bot para este usuario' : 'Silenciar bot para este usuario'} onClick={() => onToggleBotForUser(session)} className="text-xs">
            <Bot size={13} className="mr-1.5" />
            {session.bot_disabled_for_user ? 'Reactivar bot' : 'Silenciar bot'}
          </Button>
          <Button size="sm" variant={session.human_takeover ? 'default' : 'outline'} aria-label={session.human_takeover ? 'Devolver conversación al bot' : 'Tomar conversación manualmente'} onClick={() => onToggleTakeover(session)} className="text-xs">
            <UserCheck size={13} className="mr-1.5" />
            {session.human_takeover ? 'Devolver al bot' : 'Tomar conversación'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {(!session.history || session.history.length === 0) ? (
          <p className="text-center text-sm text-muted-foreground py-8">Sin mensajes en el historial.</p>
        ) : session.history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${msg.role === 'user' ? 'bg-muted text-foreground rounded-tl-sm' : 'bg-primary text-primary-foreground rounded-tr-sm'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {session.history?.length > 0 &&
          session.history[session.history.length - 1].role === 'user' &&
          !session.human_takeover &&
          !session.bot_disabled_for_user && (
          <div className="flex justify-end">
            <div className="bg-primary rounded-2xl rounded-tr-sm px-3.5 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-primary-foreground/80 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-primary-foreground/80 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-primary-foreground/80 rounded-full animate-bounce" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {session.state && Object.keys(session.state).length > 0 && (
        <div className="border-t shrink-0">
          <button
            onClick={() => setStateOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <span>Estado de sesión (debug)</span>
            {stateOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {stateOpen && (
            <pre className="px-4 pb-3 text-xs font-mono text-foreground overflow-x-auto max-h-40 bg-muted/30">
              {JSON.stringify(session.state, null, 2)}
            </pre>
          )}
        </div>
      )}

      {session.human_takeover && (
        <div className="px-4 py-3 border-t shrink-0">
          {sendError && <p className="text-xs text-destructive mb-2">{sendError}</p>}
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
  )
}
