import { UserCheck, MessageSquare } from 'lucide-react'
import { timeAgo } from '@/lib/formatters'
import type { Session } from '@/components/ChatPanel'

interface SessionListProps {
  sessions: Session[]
  selected: Session | null
  showAll: boolean
  onSelect: (session: Session) => void
}

export default function SessionList({ sessions, selected, showAll, onSelect }: SessionListProps) {
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
    </>
  )
}
