import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserCheck, RefreshCw, Download } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/formatters'
import LeadDetailModal from '@/components/LeadDetailModal'

const PAGE_SIZE = 15

interface Cliente {
  id: string
  company_name: string
}

interface HistoryMsg {
  role: 'user' | 'assistant'
  content: string
}

interface Lead {
  id: string
  client_id: string
  customer_name: string
  customer_phone: string
  company: string
  need: string
  budget_range: string
  timeline: string
  status: 'new' | 'contacted' | 'qualified' | 'lost' | 'won'
  notes: string
  raw_conversation: HistoryMsg[] | null
  created_at: string
}

const statusConfig: Record<Lead['status'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  new: { label: 'Nuevo', variant: 'default' },
  contacted: { label: 'Contactado', variant: 'secondary' },
  qualified: { label: 'Calificado', variant: 'outline' },
  lost: { label: 'Perdido', variant: 'destructive' },
  won: { label: 'Ganado', variant: 'default' },
}

const statusOptions: Lead['status'][] = ['new', 'contacted', 'qualified', 'lost', 'won']


function exportCSV(leads: Lead[]) {
  const headers = ['Nombre', 'Empresa', 'Teléfono', 'Necesidad', 'Presupuesto', 'Timeline', 'Estado', 'Fecha']
  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
  const rows = leads.map(l => [
    escape(l.customer_name),
    escape(l.company),
    escape(l.customer_phone),
    escape(l.need),
    escape(l.budget_range),
    escape(l.timeline),
    escape(statusConfig[l.status]?.label ?? l.status),
    escape(formatDate(l.created_at)),
  ].join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Leads() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [detalle, setDetalle] = useState<Lead | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [version, setVersion] = useState(0)

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
    fetchLeads()
  }, [clienteId, page, filterStatus, version])

  useEffect(() => {
    if (!clienteId) return
    const channel = supabase
      .channel(`leads-${clienteId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
        filter: `client_id=eq.${clienteId}`,
      }, () => { setPage(0); setVersion(v => v + 1) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [clienteId])

  async function fetchLeads() {
    setLoading(true)
    const from = page * PAGE_SIZE
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('client_id', clienteId)
      .order('created_at', { ascending: false })
    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus)
    }
    const { data, count } = await query.range(from, from + PAGE_SIZE - 1)
    setLeads((data ?? []) as Lead[])
    setTotal(count ?? 0)
    setLoading(false)
  }

  async function exportAllLeads() {
    let query = supabase
      .from('leads')
      .select('*')
      .eq('client_id', clienteId)
      .order('created_at', { ascending: false })
    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus)
    }
    const { data } = await query
    exportCSV((data ?? []) as Lead[])
  }

  async function updateStatus(id: string, status: Lead['status']) {
    const { error } = await supabase.from('leads').update({ status }).eq('id', id)
    if (error) { toast.error('Error al actualizar el estado'); return }
    toast.success('Estado actualizado')
    fetchLeads()
    if (detalle?.id === id) setDetalle(prev => prev ? { ...prev, status } : null)
  }

  async function updateNotes(id: string, notes: string) {
    const { error } = await supabase.from('leads').update({ notes }).eq('id', id)
    if (!error) toast.success('Notas guardadas')
    fetchLeads()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Leads</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} lead{total !== 1 ? 's' : ''}{filterStatus !== 'all' ? ` · ${statusConfig[filterStatus as Lead['status']]?.label ?? filterStatus}` : ' en total'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={clienteId} onValueChange={v => { setClienteId(v); setPage(0) }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0) }}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {statusOptions.map(s => (
                <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportAllLeads} disabled={total === 0}>
            <Download size={15} className="mr-1.5" />Exportar CSV
          </Button>
          <Button variant="outline" size="icon" aria-label="Refrescar leads" onClick={fetchLeads} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contacto</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Necesidad</TableHead>
              <TableHead>Presupuesto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-16">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!clienteId ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Selecciona un cliente.
                </TableCell>
              </TableRow>
            ) : loading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-28 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-36 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-20 bg-muted rounded-full animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-10 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))}
              </>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  <UserCheck size={32} className="mx-auto mb-2 opacity-30" />
                  No hay leads{filterStatus !== 'all' ? ' con este estado' : ''}.
                </TableCell>
              </TableRow>
            ) : leads.map(l => (
              <TableRow key={l.id}>
                <TableCell>
                  <p className="font-medium text-sm">{l.customer_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{l.customer_phone || ''}</p>
                </TableCell>
                <TableCell className="text-sm">{l.company || '—'}</TableCell>
                <TableCell className="text-sm max-w-[180px] truncate">{l.need || '—'}</TableCell>
                <TableCell className="text-sm">{l.budget_range || '—'}</TableCell>
                <TableCell>
                  <Badge variant={statusConfig[l.status]?.variant ?? 'outline'}>
                    {statusConfig[l.status]?.label ?? l.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(l.created_at)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setDetalle(l)}>Ver</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t text-sm text-muted-foreground">
            <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}</span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>Siguiente</Button>
            </div>
          </div>
        )}
      </div>

      <LeadDetailModal
        lead={detalle}
        onClose={() => setDetalle(null)}
        onUpdateStatus={updateStatus}
        onUpdateNotes={updateNotes}
      />
    </div>
  )
}
