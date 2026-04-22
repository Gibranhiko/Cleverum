import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CHATBOT_URL, chatbotHeaders } from '@/lib/config'
import { timeAgo } from '@/lib/formatters'
import { Switch } from '@/components/ui/switch'
import { AlertTriangle, MessageSquare, ShoppingCart, Users, TrendingUp } from 'lucide-react'

interface Analytics {
  client_id: string
  company_name: string
  bot_type: string
  unique_users: number
  total_orders: number
  total_leads: number
  orders_last_7d: number
  leads_last_7d: number
  last_activity: string | null
}

interface BotCard {
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

const botTypeLabel: Record<string, string> = {
  informativo: 'Informativo',
  catalogo: 'Catálogo',
  leads: 'Leads',
}

const botTypeBadgeClass: Record<string, string> = {
  informativo: 'bg-blue-100 text-blue-700',
  catalogo: 'bg-green-100 text-green-700',
  leads: 'bg-purple-100 text-purple-700',
}

function isStale(iso?: string) {
  if (!iso) return true
  return Date.now() - new Date(iso).getTime() > 24 * 60 * 60 * 1000
}

export default function Dashboard() {
  const [bots, setBots] = useState<BotCard[]>([])
  const [analytics, setAnalytics] = useState<Analytics[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
    fetchBots()

    const channel = supabase
      .channel('dashboard-clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, fetchBots)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchAnalytics() {
    const { data } = await supabase.from('bot_analytics').select('*')
    if (data) setAnalytics(data as Analytics[])
  }

  async function fetchBots() {
    setLoading(true)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const { data: clients } = await supabase
      .from('clients')
      .select('id, company_name, bot_type, whatsapp_phone, bot_active')
      .eq('is_active', true)
      .order('company_name')

    if (!clients) { setLoading(false); return }

    const ids = clients.map(c => c.id)

    const [{ data: sessions }, { data: orders }, { data: leads }] = await Promise.all([
      supabase
        .from('conversation_sessions')
        .select('client_id, last_message_at')
        .in('client_id', ids),
      supabase
        .from('orders')
        .select('client_id, created_at')
        .in('client_id', ids)
        .gte('created_at', today.toISOString()),
      supabase
        .from('leads')
        .select('client_id, created_at')
        .in('client_id', ids)
        .gte('created_at', weekAgo.toISOString()),
    ])

    const lastMsg: Record<string, string> = {}
    const activeToday: Record<string, number> = {}
    for (const s of sessions ?? []) {
      if (!lastMsg[s.client_id] || s.last_message_at > lastMsg[s.client_id]) {
        lastMsg[s.client_id] = s.last_message_at
      }
      if (s.last_message_at && new Date(s.last_message_at) >= today) {
        activeToday[s.client_id] = (activeToday[s.client_id] ?? 0) + 1
      }
    }

    const orderCount: Record<string, number> = {}
    for (const o of orders ?? []) {
      orderCount[o.client_id] = (orderCount[o.client_id] ?? 0) + 1
    }

    const leadsCount: Record<string, number> = {}
    for (const l of leads ?? []) {
      leadsCount[l.client_id] = (leadsCount[l.client_id] ?? 0) + 1
    }

    setBots(clients.map(c => ({
      ...c,
      last_message_at: lastMsg[c.id],
      active_today: activeToday[c.id] ?? 0,
      orders_today: orderCount[c.id] ?? 0,
      leads_week: leadsCount[c.id] ?? 0,
    })))
    setLoading(false)
  }

  async function toggleBot(botId: string, current: boolean) {
    setTogglingId(botId)
    try {
      await fetch(`${CHATBOT_URL}/bots/${botId}/toggle`, { method: 'PUT', headers: chatbotHeaders })
      setBots(prev => prev.map(b => b.id === botId ? { ...b, bot_active: !current } : b))
    } catch {
      // fallback: update DB directly
      await supabase.from('clients').update({ bot_active: !current }).eq('id', botId)
      setBots(prev => prev.map(b => b.id === botId ? { ...b, bot_active: !current } : b))
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Estado de todos los bots activos</p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando...</div>
      ) : bots.length === 0 ? (
        <div className="text-sm text-muted-foreground">No hay clientes activos.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {bots.map(bot => (
            <div key={bot.id} className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
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
                <Switch
                  checked={bot.bot_active}
                  disabled={togglingId === bot.id}
                  onCheckedChange={() => toggleBot(bot.id, bot.bot_active)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    <MessageSquare size={12} />
                    <span className="text-xs">Activos hoy</span>
                  </div>
                  <p className="text-xl font-semibold">{bot.active_today}</p>
                </div>

                {bot.bot_type === 'catalogo' ? (
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <ShoppingCart size={12} />
                      <span className="text-xs">Pedidos hoy</span>
                    </div>
                    <p className="text-xl font-semibold">{bot.orders_today}</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <Users size={12} />
                      <span className="text-xs">Leads 7d</span>
                    </div>
                    <p className="text-xl font-semibold">{bot.leads_week}</p>
                  </div>
                )}
              </div>

              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${isStale(bot.last_message_at) ? 'bg-yellow-50 text-yellow-700' : 'bg-muted/50 text-muted-foreground'}`}>
                {isStale(bot.last_message_at) && <AlertTriangle size={12} className="shrink-0" />}
                <span>Último mensaje: {timeAgo(bot.last_message_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {analytics.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Analytics acumulados</h3>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Usuarios únicos</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Pedidos (7d)</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Leads (7d)</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {analytics.map(a => (
                  <tr key={a.client_id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{a.company_name}</td>
                    <td className="px-4 py-3 text-right">{a.unique_users}</td>
                    <td className="px-4 py-3 text-right">{a.orders_last_7d}</td>
                    <td className="px-4 py-3 text-right">{a.leads_last_7d}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {a.last_activity ? timeAgo(a.last_activity) : 'Nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
