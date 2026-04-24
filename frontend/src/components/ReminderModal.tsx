import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

interface ReminderForm {
  message: string
  phone_numbers: string
  frequency: string
  hour: string
  minute: string
}

export interface ReminderForEdit {
  id: string
  message: string
  phone_numbers: string[]
  frequency: string
  hour: number
  minute: number
}

interface ReminderModalProps {
  open: boolean
  clienteId: string
  reminder: ReminderForEdit | null
  onClose: () => void
  onSaved: () => void
}

const EMPTY_FORM: ReminderForm = { message: '', phone_numbers: '', frequency: 'daily', hour: '9', minute: '0' }
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

export default function ReminderModal({ open, clienteId, reminder, onClose, onSaved }: ReminderModalProps) {
  const [form, setForm] = useState<ReminderForm>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setError('')
      setForm(reminder ? {
        message: reminder.message,
        phone_numbers: reminder.phone_numbers.join(', '),
        frequency: reminder.frequency,
        hour: String(reminder.hour),
        minute: String(reminder.minute),
      } : EMPTY_FORM)
    }
  }, [open, reminder])

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
    const { error: e } = reminder
      ? await supabase.from('reminders').update(payload).eq('id', reminder.id)
      : await supabase.from('reminders').insert(payload)
    setSaving(false)
    if (e) { setError(e.message); return }
    onClose()
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{reminder ? 'Editar reminder' : 'Nuevo reminder'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Mensaje *</Label>
            <textarea
              value={form.message}
              onChange={e => setF('message', e.target.value)}
              placeholder="Ej. Recuerda que mañana tenemos promoción especial"
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
                  {MINUTES.map(m => (
                    <SelectItem key={m} value={String(m)}>:{String(m).padStart(2, '0')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
