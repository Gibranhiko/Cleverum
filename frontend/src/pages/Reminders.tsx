import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/formatters'
import ReminderModal from '@/components/ReminderModal'
import type { ReminderForEdit } from '@/components/ReminderModal'

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

const FREQ_LABEL: Record<string, string> = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' }

function ftime(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function Reminders() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editReminder, setEditReminder] = useState<ReminderForEdit | null>(null)
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
    setEditReminder(null)
    setModalOpen(true)
  }

  function openEdit(r: Reminder) {
    setEditReminder({ id: r.id, message: r.message, phone_numbers: r.phone_numbers, frequency: r.frequency, hour: r.hour, minute: r.minute })
    setModalOpen(true)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('reminders').delete().eq('id', deleteId)
    setDeleteId(null)
    setDeleting(false)
    if (error) { toast.error('Error al eliminar el reminder'); return }
    toast.success('Reminder eliminado')
    fetchReminders()
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await supabase.from('reminders').update({ active: !current }).eq('id', id)
    if (error) { toast.error('Error al cambiar estado'); return }
    toast.success(current ? 'Reminder desactivado' : 'Reminder activado')
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
              <>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-48 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted rounded-full animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-10 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))}
              </>
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
                    <Button variant="ghost" size="icon" aria-label={r.active ? 'Desactivar reminder' : 'Activar reminder'} onClick={() => toggleActive(r.id, r.active)}>
                      {r.active
                        ? <Bell size={15} className="text-emerald-500" />
                        : <BellOff size={15} className="text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Editar reminder" onClick={() => openEdit(r)}><Pencil size={15} /></Button>
                    <Button variant="ghost" size="icon" aria-label="Eliminar reminder" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ReminderModal
        open={modalOpen}
        clienteId={clienteId}
        reminder={editReminder}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          toast.success(editReminder ? 'Reminder actualizado' : 'Reminder creado')
          fetchReminders()
        }}
      />

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
