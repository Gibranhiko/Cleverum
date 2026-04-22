import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Plus, Pencil, Trash2, Bell, BellOff } from 'lucide-react'
import { formatDate } from '@/lib/formatters'

interface Cliente { id: string; company_name: string }

interface Reminder {
  id: string
  client_id: string
  message: string
  phone_numbers: string[]
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  active: boolean
  last_sent: string | null
  created_at: string
}

interface ReminderForm {
  message: string
  phone_numbers: string
  frequency: string
  hour: string
  minute: string
}

const EMPTY_FORM: ReminderForm = { message: '', phone_numbers: '', frequency: 'daily', hour: '9', minute: '0' }
const FREQ_LABEL: Record<string, string> = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' }
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8)

function ftime(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function Reminders() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ReminderForm>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  useEffect(() => { if (clienteId) fetchReminders() }, [clienteId])

  async function fetchReminders() {
    setLoading(true)
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .eq('client_id', clienteId)
      .order('created_at', { ascending: false })
    setReminders((data ?? []) as Reminder[])
    setLoading(false)
  }

  function openNew() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setError('')
    setModalOpen(true)
  }

  function openEdit(r: Reminder) {
    setEditId(r.id)
    setForm({
      message: r.message,
      phone_numbers: r.phone_numbers.join(', '),
      frequency: r.frequency,
      hour: String(r.hour),
      minute: String(r.minute),
    })
    setError('')
    setModalOpen(true)
  }

  function setF(field: keyof ReminderForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.message.trim()) { setError('El mensaje es requerido'); return }
    setSaving(true)
    setError('')
    const phones = form.phone_numbers.split(',').map(p => p.trim()).filter(Boolean)
    const payload = {
      client_id: clienteId,
      message: form.message.trim(),
      phone_numbers: phones,
      frequency: form.frequency,
      hour: parseInt(form.hour),
      minute: parseInt(form.minute),
    }
    const { error: e } = editId
      ? await supabase.from('reminders').update(payload).eq('id', editId)
      : await supabase.from('reminders').insert(payload)
    setSaving(false)
    if (e) { setError(e.message); return }
    setModalOpen(false)
    fetchReminders()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('reminders').delete().eq('id', deleteId)
    setDeleteId(null)
    setDeleting(false)
    fetchReminders()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('reminders').update({ active: !current }).eq('id', id)
    fetchReminders()
  }

  const activeCount = reminders.filter(r => r.active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Reminders</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} activo{activeCount !== 1 ? 's' : ''} · {reminders.length} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} disabled={!clienteId}>
            <Plus size={16} className="mr-1.5" />Nuevo reminder
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mensaje</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Teléfonos</TableHead>
              <TableHead>Último envío</TableHead>
              <TableHead className="w-28">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!clienteId ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Selecciona un cliente.</TableCell></TableRow>
            ) : loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : reminders.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No hay reminders. Crea el primero.</TableCell></TableRow>
            ) : reminders.map(r => (
              <TableRow key={r.id} className={!r.active ? 'opacity-50' : ''}>
                <TableCell className="text-sm max-w-xs truncate">{r.message}</TableCell>
                <TableCell><Badge variant="secondary">{FREQ_LABEL[r.frequency]}</Badge></TableCell>
                <TableCell className="text-sm font-mono">{ftime(r.hour, r.minute)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.phone_numbers.length > 0 ? `${r.phone_numbers.length} número${r.phone_numbers.length !== 1 ? 's' : ''}` : 'Todos'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.last_sent ? formatDate(r.last_sent) : 'Nunca'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => toggleActive(r.id, r.active)} title={r.active ? 'Desactivar' : 'Activar'}>
                      {r.active
                        ? <Bell size={15} className="text-emerald-500" />
                        : <BellOff size={15} className="text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil size={15} /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal crear / editar */}
      <Dialog open={modalOpen} onOpenChange={() => setModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar reminder' : 'Nuevo reminder'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Mensaje *</Label>
              <textarea
                value={form.message}
                onChange={e => setF('message', e.target.value)}
                placeholder="Ej. Recuerda que mañana tenemos promoción especial 🎉"
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfonos (separados por coma)</Label>
              <Input
                value={form.phone_numbers}
                onChange={e => setF('phone_numbers', e.target.value)}
                placeholder="+52 55 1234 5678, +52 55 9876 5432"
              />
              <p className="text-xs text-muted-foreground">Dejar vacío para enviar a todos los contactos activos del cliente.</p>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Frecuencia</Label>
                <Select value={form.frequency} onValueChange={v => setF('frequency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diario</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hora</Label>
                <Select value={form.hour} onValueChange={v => setF('hour', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS.map(h => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Minuto</Label>
                <Select value={form.minute} onValueChange={v => setF('minute', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">:00</SelectItem>
                    <SelectItem value="30">:30</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar reminder?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
