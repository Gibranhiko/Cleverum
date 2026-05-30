import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { CalendarDays, Search, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface Cliente {
  id: string
  company_name: string
  bot_type: string
}

interface Appointment {
  id: string
  client_id: string
  customer_phone: string
  customer_name: string | null
  service: string | null
  starts_at: string
  ends_at: string
  status: string
  status_history: { status: string; at: string; by: string; note: string | null }[]
  origin: string
  calendar_synced: boolean
  internal_notes: string | null
  created_at: string
}

const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  nueva:      { label: 'Nueva',       variant: 'secondary' },
  confirmada: { label: 'Confirmada',  variant: 'default' },
  completada: { label: 'Completada',  variant: 'outline' },
  cancelada:  { label: 'Cancelada',   variant: 'destructive' },
  no_asistio: { label: 'No asistió',  variant: 'destructive' },
}

const TABS: { key: string; label: string }[] = [
  { key: 'all',        label: 'Todas' },
  { key: 'nueva',      label: 'Nuevas' },
  { key: 'confirmada', label: 'Confirmadas' },
  { key: 'completada', label: 'Completadas' },
  { key: 'cancelada',  label: 'Canceladas' },
]

function fmt(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', ...opts })
}

export default function Citas() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [appts, setAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, company_name, bot_type')
      .eq('is_active', true)
      .order('company_name')
      .then(({ data }) => {
        const list = data ?? []
        setClientes(list)
        const first = list.find(c => c.bot_type === 'informativo') ?? list[0]
        if (first) setClienteId(first.id)
      })
  }, [])

  useEffect(() => {
    if (!clienteId) return
    fetchAppts()
  }, [clienteId])

  // Realtime: nuevas citas / cambios del cliente (D5)
  useEffect(() => {
    if (!clienteId) return
    const channel = supabase
      .channel(`appointments-${clienteId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'appointments',
        filter: `client_id=eq.${clienteId}`,
      }, () => { toast.success('📅 Nueva cita registrada'); fetchAppts() })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'appointments',
        filter: `client_id=eq.${clienteId}`,
      }, () => fetchAppts())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clienteId])

  async function fetchAppts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('client_id', clienteId)
      .order('starts_at', { ascending: false })
    setLoading(false)
    if (error) { toast.error('Error al cargar citas'); return }
    setAppts((data ?? []) as Appointment[])
  }

  function openDetail(a: Appointment) {
    setSelected(a)
    setEditStatus(a.status)
    setEditNotes(a.internal_notes ?? '')
  }

  async function save() {
    if (!selected) return
    setSaving(true)
    const history = [
      ...(selected.status_history ?? []),
      ...(editStatus !== selected.status
        ? [{ status: editStatus, at: new Date().toISOString(), by: 'panel', note: null }]
        : []),
    ]
    const { error } = await supabase
      .from('appointments')
      .update({ status: editStatus, internal_notes: editNotes, status_history: history, updated_at: new Date().toISOString() })
      .eq('id', selected.id)
    setSaving(false)
    if (error) { toast.error('No se pudo guardar'); return }
    toast.success('Cita actualizada')
    setSelected(null)
    fetchAppts()
  }

  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = t.key === 'all' ? appts.length : appts.filter(a => a.status === t.key).length
    return acc
  }, {} as Record<string, number>)

  const filtered = appts.filter(a => {
    const matchTab = tab === 'all' || a.status === tab
    const matchSearch = !search.trim() ||
      a.customer_phone.includes(search) ||
      (a.customer_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (a.service?.toLowerCase().includes(search.toLowerCase()) ?? false)
    return matchTab && matchSearch
  })

  const selectedCliente = clientes.find(c => c.id === clienteId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Citas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} cita{filtered.length !== 1 ? 's' : ''}
            {appts.length !== filtered.length && ` (de ${appts.length})`}
          </p>
        </div>
        <Select value={clienteId} onValueChange={v => { setClienteId(v); setSearch(''); setTab('all') }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
          <SelectContent>
            {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs por estado */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              tab === t.key ? 'bg-violet-600 text-white font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {t.label} <span className="opacity-70">{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="relative max-w-xs w-full">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, teléfono o servicio..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Origen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!clienteId ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Selecciona un cliente.</TableCell></TableRow>
            ) : loading ? (
              [...Array(4)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(6)].map((_, j) => <TableCell key={j}><div className="h-4 w-24 bg-muted rounded animate-pulse" /></TableCell>)}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
                  {appts.length === 0 ? 'Aún no hay citas. Cuando un cliente agende desde WhatsApp, aparecerá aquí.' : 'No hay citas que coincidan.'}
                </TableCell>
              </TableRow>
            ) : filtered.map(a => {
              const badge = STATUS[a.status] ?? { label: a.status, variant: 'outline' as const }
              return (
                <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(a)}>
                  <TableCell>
                    <p className="text-sm">{a.customer_name ?? '—'}</p>
                    <p className="text-xs font-mono text-muted-foreground">{a.customer_phone}</p>
                  </TableCell>
                  <TableCell className="text-sm">{a.service ?? '—'}</TableCell>
                  <TableCell className="text-sm">{fmt(a.starts_at, { dateStyle: 'medium' })}</TableCell>
                  <TableCell className="text-sm">{fmt(a.starts_at, { timeStyle: 'short' })}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {!a.calendar_synced && a.status !== 'cancelada' && (
                        <span title="Sin sincronizar con Google Calendar"><AlertTriangle size={14} className="text-yellow-500" /></span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">{a.origin}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {selectedCliente && selectedCliente.bot_type !== 'informativo' && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Este cliente tiene bot tipo <strong>{selectedCliente.bot_type}</strong>. Las citas con agenda se generan desde bots tipo <strong>Informativo</strong> con Citas habilitadas.
        </div>
      )}

      {/* Modal de detalle */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de cita</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Cliente</p><p className="font-medium">{selected.customer_name ?? '—'}</p></div>
                <div><p className="text-muted-foreground">Teléfono</p><p className="font-mono">{selected.customer_phone}</p></div>
                <div><p className="text-muted-foreground">Servicio</p><p>{selected.service ?? '—'}</p></div>
                <div><p className="text-muted-foreground">Origen</p><p className="capitalize">{selected.origin}</p></div>
                <div><p className="text-muted-foreground">Fecha</p><p>{fmt(selected.starts_at, { dateStyle: 'full' })}</p></div>
                <div><p className="text-muted-foreground">Hora</p><p>{fmt(selected.starts_at, { timeStyle: 'short' })} – {fmt(selected.ends_at, { timeStyle: 'short' })}</p></div>
              </div>

              {!selected.calendar_synced && selected.status !== 'cancelada' && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                  <AlertTriangle size={14} /> No se sincronizó con Google Calendar. Agéndala manualmente en el calendario.
                </div>
              )}

              <div>
                <Label>Estado</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notas internas</Label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  placeholder="Notas para el equipo (no se envían al cliente)"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
