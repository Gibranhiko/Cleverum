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
import { CHATBOT_URL } from '@/lib/config'

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
  no_asistio: { label: 'No asistió',  variant: 'destructive' },
  cancelada:  { label: 'Cancelada',   variant: 'destructive' },
  pasada:     { label: 'Pasada',      variant: 'outline' },
}

// Estados que el operador puede fijar a mano. 'cancelada' va por el botón
// dedicado (libera Calendar); 'pasada' es derivado, no se asigna.
const EDITABLE_STATUS = ['nueva', 'confirmada', 'completada', 'no_asistio']

const TABS: { key: string; label: string }[] = [
  { key: 'all',        label: 'Todas' },
  { key: 'nueva',      label: 'Nuevas' },
  { key: 'confirmada', label: 'Confirmadas' },
  { key: 'pasada',     label: 'Pasadas' },
  { key: 'cancelada',  label: 'Canceladas' },
]

// Cita vencida = ya terminó y no está cancelada.
function isPast(a: Appointment): boolean {
  return a.status !== 'cancelada' && new Date(a.ends_at).getTime() < Date.now()
}

// Estado efectivo para el badge (deriva 'pasada' sin escribir en BD).
function displayStatus(a: Appointment): string {
  if (a.status === 'cancelada') return 'cancelada'
  if (a.status === 'completada' || a.status === 'no_asistio') return a.status
  if (isPast(a)) return 'pasada'
  return a.status
}

// Bucket para los tabs.
function bucketOf(a: Appointment): string {
  if (a.status === 'cancelada') return 'cancelada'
  if (isPast(a)) return 'pasada'
  return a.status // nueva | confirmada (futuras)
}

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
  // Reagenda
  const [rescheduling, setRescheduling] = useState(false)
  const [rdays, setRdays] = useState<{ value: string; label: string }[]>([])
  const [rday, setRday] = useState('')
  const [rslots, setRslots] = useState<{ value: string; label: string }[]>([])
  const [rslot, setRslot] = useState('')
  const [rloading, setRloading] = useState(false)

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
    setRescheduling(false)
    setRday(''); setRslot(''); setRslots([]); setRdays([])
  }

  async function authHeaders(): Promise<Record<string, string> | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error('Sesión expirada'); return null }
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
  }

  async function startReschedule() {
    if (!selected) return
    setRescheduling(true); setRday(''); setRslot(''); setRslots([]); setRdays([]); setRloading(true)
    const headers = await authHeaders()
    if (!headers) { setRloading(false); return }
    const res = await fetch(`${CHATBOT_URL}/appointments/${selected.id}/days`, { headers })
    setRloading(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      toast.error(b.error ?? 'No se pudieron cargar los días')
      setRescheduling(false)
      return
    }
    const { days } = await res.json()
    setRdays(days)
    if (days.length > 0) pickDay(days[0].value) // abre con el primer día disponible
  }

  async function pickDay(day: string) {
    if (!selected) return
    setRday(day); setRslot(''); setRslots([]); setRloading(true)
    const headers = await authHeaders()
    if (!headers) { setRloading(false); return }
    const res = await fetch(`${CHATBOT_URL}/appointments/${selected.id}/slots?day=${day}`, { headers })
    setRloading(false)
    if (!res.ok) { toast.error('No se pudieron cargar los horarios'); return }
    const { slots } = await res.json()
    setRslots(slots)
  }

  async function confirmReschedule() {
    if (!selected || !rslot) return
    setSaving(true)
    const headers = await authHeaders()
    if (!headers) { setSaving(false); return }
    const res = await fetch(`${CHATBOT_URL}/appointments/${selected.id}/reschedule`, {
      method: 'POST', headers, body: JSON.stringify({ start: rslot }),
    })
    setSaving(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      toast.error(b.error ?? 'No se pudo reagendar')
      if (rday) pickDay(rday) // recargar slots por si se ocupó
      return
    }
    toast.success('Cita reagendada')
    setSelected(null)
    fetchAppts()
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

  async function cancelar() {
    if (!selected) return
    if (!confirm('¿Cancelar esta cita? Se libera el horario y se borra del calendario.')) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); toast.error('Sesión expirada'); return }
    const res = await fetch(`${CHATBOT_URL}/appointments/${selected.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'No se pudo cancelar')
      return
    }
    toast.success('Cita cancelada')
    setSelected(null)
    fetchAppts()
  }

  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = t.key === 'all' ? appts.length : appts.filter(a => bucketOf(a) === t.key).length
    return acc
  }, {} as Record<string, number>)

  const filtered = appts.filter(a => {
    const matchTab = tab === 'all' || bucketOf(a) === tab
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
              const badge = STATUS[displayStatus(a)] ?? { label: a.status, variant: 'outline' as const }
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
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
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

              {rescheduling ? (
                <div className="space-y-3">
                  {rdays.length === 0 && !rloading ? (
                    <p className="text-sm text-muted-foreground">No hay días disponibles en las próximas fechas.</p>
                  ) : (
                    <>
                      <div>
                        <Label>Nuevo día</Label>
                        <input
                          type="date"
                          value={rday}
                          min={rdays[0]?.value}
                          max={rdays[rdays.length - 1]?.value}
                          onChange={e => e.target.value && pickDay(e.target.value)}
                          className="mt-1 block rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                        />
                      </div>

                      {rday && (
                        <div>
                          <Label>Nuevo horario</Label>
                          {rloading ? (
                            <p className="text-sm text-muted-foreground mt-1">Cargando horarios...</p>
                          ) : rslots.length === 0 ? (
                            <p className="text-sm text-muted-foreground mt-1">No hay horarios libres ese día. Elige otro.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {rslots.map(s => (
                                <button
                                  key={s.value}
                                  onClick={() => setRslot(s.value)}
                                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${rslot === s.value ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted hover:bg-muted/70 border-transparent'}`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <Label>Estado</Label>
                    <Select value={EDITABLE_STATUS.includes(editStatus) ? editStatus : 'nueva'} onValueChange={setEditStatus}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EDITABLE_STATUS.map(k => <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Para cancelar usa el botón de abajo (libera el horario y borra del calendario).</p>
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
                </>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {rescheduling ? (
              <>
                <Button variant="outline" onClick={() => setRescheduling(false)} disabled={saving}>← Volver</Button>
                <Button onClick={confirmReschedule} disabled={saving || !rslot}>{saving ? 'Moviendo...' : 'Mover cita'}</Button>
              </>
            ) : (
              <>
                {selected && selected.status !== 'cancelada' ? (
                  <Button variant="destructive" onClick={cancelar} disabled={saving}>Cancelar cita</Button>
                ) : <span />}
                <div className="flex gap-2">
                  {selected && selected.status !== 'cancelada' && (
                    <Button variant="outline" onClick={startReschedule} disabled={saving}>🕐 Reagendar</Button>
                  )}
                  <Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button>
                  <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
