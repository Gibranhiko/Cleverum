import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TicketDetailModal, { type Ticket } from '@/components/TicketDetailModal'
import { Receipt, Search } from 'lucide-react'
import { toast } from 'sonner'

interface Cliente {
  id: string
  company_name: string
  bot_type: string
}

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  recibido:      { label: 'Recibido',           variant: 'secondary' },
  diagnostico:   { label: 'Diagnóstico',        variant: 'secondary' },
  cotizado:      { label: 'Cotizado',           variant: 'default' },
  aprobado:      { label: 'Aprobado',           variant: 'default' },
  en_reparacion: { label: 'En reparación',      variant: 'default' },
  listo:         { label: 'Listo',              variant: 'default' },
  entregado:     { label: 'Entregado',          variant: 'outline' },
  rechazado:     { label: 'Rechazado',          variant: 'destructive' },
  cancelado:     { label: 'Cancelado',          variant: 'outline' },
}

export default function Tickets() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState<string>('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, company_name, bot_type')
      .eq('is_active', true)
      .order('company_name')
      .then(({ data }) => {
        const list = data ?? []
        setClientes(list)
        const first = list.find(c => c.bot_type === 'servicios') ?? list[0]
        if (first) setClienteId(first.id)
      })
  }, [])

  useEffect(() => {
    if (!clienteId) return
    fetchTickets()
  }, [clienteId])

  // Realtime: cuando se crea o actualiza un ticket del cliente
  useEffect(() => {
    if (!clienteId) return
    const channel = supabase
      .channel(`tickets-${clienteId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `client_id=eq.${clienteId}`,
      }, () => fetchTickets())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clienteId])

  async function fetchTickets() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('client_id', clienteId)
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) { toast.error('Error al cargar tickets'); return }
    setTickets((data ?? []) as Ticket[])
  }

  const filtered = tickets.filter(t => {
    const matchSearch = !search.trim() ||
      t.folio.toLowerCase().includes(search.toLowerCase()) ||
      t.customer_phone.includes(search) ||
      (t.customer_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const selectedCliente = clientes.find(c => c.id === clienteId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Tickets</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
            {tickets.length !== filtered.length && ` (de ${tickets.length})`}
          </p>
        </div>
        <Select value={clienteId} onValueChange={v => { setClienteId(v); setSearch(''); setStatusFilter('all') }}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Seleccionar cliente" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCliente && selectedCliente.bot_type !== 'servicios' && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Este cliente tiene bot tipo <strong>{selectedCliente.bot_type}</strong>. Los tickets se generan desde bots tipo <strong>Servicios</strong>.
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, teléfono o nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS_BADGES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Equipo</TableHead>
              <TableHead>Problema</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Creado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!clienteId ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Selecciona un cliente para ver sus tickets.
                </TableCell>
              </TableRow>
            ) : loading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-40 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-20 bg-muted rounded-full animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))}
              </>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                  {tickets.length === 0 ? 'Aún no hay tickets. Cuando un cliente levante una orden desde WhatsApp, aparecerá aquí.' : 'No hay tickets que coincidan con los filtros.'}
                </TableCell>
              </TableRow>
            ) : filtered.map(t => {
              const badge = STATUS_BADGES[t.status] ?? { label: t.status, variant: 'outline' as const }
              return (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => { setSelectedTicket(t); setModalOpen(true) }}
                >
                  <TableCell className="font-mono text-sm font-medium">{t.folio}</TableCell>
                  <TableCell>
                    <p className="text-sm">{t.customer_name ?? '—'}</p>
                    <p className="text-xs font-mono text-muted-foreground">{t.customer_phone}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {[t.device_brand, t.device_model].filter(Boolean).join(' ') || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {t.problem_description ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <TicketDetailModal
        open={modalOpen}
        ticket={selectedTicket}
        onClose={() => { setModalOpen(false); setSelectedTicket(null) }}
        onSaved={fetchTickets}
      />
    </div>
  )
}
