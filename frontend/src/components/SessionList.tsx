import { UserCheck, MessageSquare } from 'lucide-react'
import { timeAgo, flowLabel } from '@/lib/formatters'
import type { Session } from '@/components/ChatPanel'

interface SessionListProps {
  sessions: Session[]
  selected: Session | null
  showAll: boolean
  names: Record<string, string>
  onSelect: (session: Session) => void
}

// Último mensaje (preview) cuando no hay flujo activo.
function lastMessage(s: Session): string {
  const h = s.history ?? []
  return h.length ? h[h.length - 1].content : 'Sin mensajes'
}

export default function SessionList({ sessions, selected, showAll, names, onSelect }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
        <MessageSquare size={28} className="mb-2 opacity-30" />
        {showAll ? 'Sin conversaciones' : 'Sin actividad en 7 días'}
      </div>
    )
  }

  return (
    <>
      {sessions.map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer ${selected?.id === s.id ? 'bg-muted' : ''}`}
        >
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-sm font-medium truncate">{names[s.phone_number] ?? s.phone_number}</span>
            {s.human_takeover && <UserCheck size={12} className="text-amber-500 shrink-0" />}
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs text-muted-foreground truncate">
              {flowLabel(s.current_flow, s.flow_step) ?? lastMessage(s)}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{timeAgo(s.last_message_at)}</span>
          </div>
        </button>
      ))}
    </>
  )
}
