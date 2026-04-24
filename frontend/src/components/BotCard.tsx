import { Switch } from '@/components/ui/switch'
import { AlertTriangle, MessageSquare, ShoppingCart, Users } from 'lucide-react'
import { timeAgo } from '@/lib/formatters'

export interface BotCardData {
  id: string
  company_name: string
  bot_type: string
  whatsapp_phone: string
  bot_active: boolean
  last_message_at?: string
  active_today?: number
  orders_today?: number
  leads_week?: number
}

interface BotCardProps {
  bot: BotCardData
  toggling: boolean
  onToggle: () => void
}

const botTypeLabel: Record<string, string> = {
  informativo: 'Informativo',
  catalogo: 'Catálogo',
  leads: 'Leads',
}

const botTypeBadgeClass: Record<string, string> = {
  informativo: 'bg-cyan-100 text-cyan-700',
  catalogo: 'bg-green-100 text-green-700',
  leads: 'bg-purple-100 text-purple-700',
}

function isStale(iso?: string) {
  if (!iso) return true
  return Date.now() - new Date(iso).getTime() > 24 * 60 * 60 * 1000
}

export default function BotCard({ bot, toggling, onToggle }: BotCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{bot.company_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{bot.whatsapp_phone || '—'}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${botTypeBadgeClass[bot.bot_type] ?? 'bg-gray-100 text-gray-600'}`}>
          {botTypeLabel[bot.bot_type] ?? bot.bot_type}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Bot activo</span>
        <Switch checked={bot.bot_active} disabled={toggling} onCheckedChange={onToggle} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
            <MessageSquare size={12} />
            <span className="text-xs">Activos hoy</span>
          </div>
          <p className="text-xl font-semibold">{bot.active_today ?? 0}</p>
        </div>
        {bot.bot_type === 'catalogo' ? (
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <ShoppingCart size={12} />
              <span className="text-xs">Pedidos hoy</span>
            </div>
            <p className="text-xl font-semibold">{bot.orders_today ?? 0}</p>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <Users size={12} />
              <span className="text-xs">Leads 7d</span>
            </div>
            <p className="text-xl font-semibold">{bot.leads_week ?? 0}</p>
          </div>
        )}
      </div>

      <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${isStale(bot.last_message_at) ? 'bg-yellow-50 text-yellow-700' : 'bg-muted/50 text-muted-foreground'}`}>
        {isStale(bot.last_message_at) && <AlertTriangle size={12} className="shrink-0" />}
        <span>Último mensaje: {timeAgo(bot.last_message_at)}</span>
      </div>
    </div>
  )
}
