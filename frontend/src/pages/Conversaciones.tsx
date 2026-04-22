import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RefreshCw, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import ChatPanel, { Session } from '@/components/ChatPanel'
import SessionList from '@/components/SessionList'

interface Cliente { id: string; company_name: string }

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export default function Conversaciones() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

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

  async function fetchSessions() {
    setLoading(true)
    setFetchError(null)
    const { data, error } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('client_id', clienteId)
      .order('last_message_at', { ascending: false })
    if (error) {
      setFetchError('Error al cargar las conversaciones.')
      setLoading(false)
      return
    }
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
    const { error } = await supabase
      .from('conversation_sessions')
      .update({ human_takeover: next })
      .eq('id', session.id)
    if (error) { toast.error('Error al cambiar takeover'); return }
    toast.success(next ? 'Takeover activado' : 'Conversación devuelta al bot')
    fetchSessions()
  }

  async function toggleBotForUser(session: Session) {
    const next = !session.bot_disabled_for_user
    const { error } = await supabase
      .from('conversation_sessions')
      .update({ bot_disabled_for_user: next })
      .eq('id', session.id)
    if (error) { toast.error('Error al cambiar estado del bot'); return }
    toast.success(next ? 'Bot silenciado para este usuario' : 'Bot reactivado')
    fetchSessions()
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
          <Button variant="outline" size="icon" aria-label="Refrescar conversaciones" onClick={fetchSessions} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>

        <div className="flex items-center gap-2 px-1">
          <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
          <Label htmlFor="show-all" className="text-xs text-muted-foreground cursor-pointer">
            Mostrar todas
          </Label>
        </div>

        {fetchError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between">
            {fetchError}
            <button onClick={fetchSessions} className="underline ml-2 cursor-pointer">Reintentar</button>
          </div>
        )}

        <div className="flex-1 rounded-lg border bg-card overflow-y-auto">
          <SessionList
            sessions={visibleSessions}
            selected={selected}
            showAll={showAll}
            onSelect={setSelected}
          />
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
          <ChatPanel
            key={selected.id}
            session={selected}
            clienteId={clienteId}
            onToggleTakeover={toggleTakeover}
            onToggleBotForUser={toggleBotForUser}
            onMessageSent={fetchSessions}
          />
        )}
      </div>
    </div>
  )
}
