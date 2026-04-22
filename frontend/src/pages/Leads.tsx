import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserCheck, RefreshCw } from 'lucide-react'

interface Cliente {
  id: string
  company_name: string
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'short' })
}

export default function Leads() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [detalle, setDetalle] = useState<Lead | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

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

    const channel = supabase
      .channel(`leads-${clienteId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
        filter: `client_id=eq.${clienteId}`,
      }, () => fetchLeads())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clienteId])

  async function fetchLeads() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('client_id', clienteId)
      .order('created_at', { ascending: false })
    setLeads((data ?? []) as Lead[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: Lead['status']) {
    await supabase.from('leads').update({ status }).eq('id', id)
    fetchLeads()
    if (detalle?.id === id) setDetalle(prev => prev ? { ...prev, status } : null)
  }

  async function updateNotes(id: string, notes: string) {
    await supabase.from('leads').update({ notes }).eq('id', id)
    fetchLeads()
  }

  const filtered = filterStatus === 'all' ? leads : leads.filter(l => l.status === filterStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Leads</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {leads.filter(l => l.status === 'new').length} lead{leads.filter(l => l.status === 'new').length !== 1 ? 's' : ''} nuevo{leads.filter(l => l.status === 'new').length !== 1 ? 's' : ''}
            {' · '}{leads.length} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
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
          <Button variant="outline" size="icon" onClick={fetchLeads} disabled={loading}>
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
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  <UserCheck size={32} className="mx-auto mb-2 opacity-30" />
                  No hay leads{filterStatus !== 'all' ? ' con este estado' : ''}.
                </TableCell>
              </TableRow>
            ) : filtered.map(l => (
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
      </div>

      <Dialog open={!!detalle} onOpenChange={() => setDetalle(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del lead</DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <span className="text-muted-foreground">Nombre</span>
                <span className="font-medium">{detalle.customer_name || '—'}</span>
                <span className="text-muted-foreground">Teléfono</span>
                <span>{detalle.customer_phone || '—'}</span>
                <span className="text-muted-foreground">Empresa</span>
                <span>{detalle.company || '—'}</span>
                <span className="text-muted-foreground">Necesidad</span>
                <span>{detalle.need || '—'}</span>
                <span className="text-muted-foreground">Presupuesto</span>
                <span>{detalle.budget_range || '—'}</span>
                <span className="text-muted-foreground">Timeline</span>
                <span>{detalle.timeline || '—'}</span>
                <span className="text-muted-foreground">Fecha</span>
                <span>{formatDate(detalle.created_at)}</span>
              </div>

              <div className="space-y-1.5">
                <p className="text-muted-foreground">Estado</p>
                <Select value={detalle.status} onValueChange={v => updateStatus(detalle.id, v as Lead['status'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => (
                      <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-muted-foreground">Notas</p>
                <NoteEditor
                  initial={detalle.notes}
                  onSave={notes => updateNotes(detalle.id, notes)}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NoteEditor({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [value, setValue] = useState(initial || '')
  const [saved, setSaved] = useState(true)

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false) }}
        rows={4}
        placeholder="Agrega notas sobre este lead..."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
      />
      <Button
        size="sm"
        variant={saved ? 'outline' : 'default'}
        onClick={() => { onSave(value); setSaved(true) }}
        disabled={saved}
      >
        {saved ? 'Guardado' : 'Guardar notas'}
      </Button>
    </div>
  )
}
