import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CHATBOT_URL, chatbotHeaders } from '@/lib/config'
import { timeAgo } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import BotCard from '@/components/BotCard'
import type { BotCardData } from '@/components/BotCard'

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

export default function Dashboard() {
  const [bots, setBots] = useState<BotCardData[]>([])
  const [analytics, setAnalytics] = useState<Analytics[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

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
    setFetchError(null)
    try {
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
    } catch {
      setFetchError('Error al cargar el dashboard. Verifica la conexión.')
    } finally {
      setLoading(false)
    }
  }

  async function toggleBot(botId: string, current: boolean) {
    setTogglingId(botId)
    try {
      await fetch(`${CHATBOT_URL}/bots/${botId}/toggle`, { method: 'PUT', headers: chatbotHeaders })
      setBots(prev => prev.map(b => b.id === botId ? { ...b, bot_active: !current } : b))
      toast.success(current ? 'Bot desactivado' : 'Bot activado')
    } catch {
      const { error } = await supabase.from('clients').update({ bot_active: !current }).eq('id', botId)
      if (error) { toast.error('Error al cambiar estado del bot') }
      else {
        setBots(prev => prev.map(b => b.id === botId ? { ...b, bot_active: !current } : b))
        toast.success(current ? 'Bot desactivado' : 'Bot activado')
      }
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

      {fetchError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between">
          {fetchError}
          <Button variant="ghost" size="sm" onClick={() => { fetchAnalytics(); fetchBots() }}>Reintentar</Button>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-36 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                <div className="h-5 w-9 bg-muted rounded-full animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1.5">
                  <div className="h-3 w-16 bg-muted rounded animate-pulse mx-auto" />
                  <div className="h-6 w-8 bg-muted rounded animate-pulse mx-auto" />
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1.5">
                  <div className="h-3 w-16 bg-muted rounded animate-pulse mx-auto" />
                  <div className="h-6 w-8 bg-muted rounded animate-pulse mx-auto" />
                </div>
              </div>
              <div className="h-8 bg-muted/50 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ) : bots.length === 0 ? (
        <div className="text-sm text-muted-foreground">No hay clientes activos.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {bots.map(bot => (
            <BotCard
              key={bot.id}
              bot={bot}
              toggling={togglingId === bot.id}
              onToggle={() => toggleBot(bot.id, bot.bot_active)}
            />
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
                  <tr key={a.client_id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
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
