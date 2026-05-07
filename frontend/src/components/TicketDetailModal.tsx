import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

export interface StatusEntry {
  status: string
  at: string
  by: string
  note: string | null
}

export interface Ticket {
  id: string
  folio: string
  client_id: string
  customer_phone: string
  customer_name: string | null
  device_type: string | null
  device_brand: string | null
  device_model: string | null
  problem_description: string | null
  problem_category: string | null
  photos: string[]
  status: string
  status_history: StatusEntry[]
  quote_amount: number | null
  internal_notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'recibido',      label: 'Recibido 📥' },
  { value: 'diagnostico',   label: 'En diagnóstico 🔍' },
  { value: 'cotizado',      label: 'Cotización lista 💰' },
  { value: 'aprobado',      label: 'Aprobado ✅' },
  { value: 'en_reparacion', label: 'En reparación 🔧' },
  { value: 'listo',         label: 'Listo para recoger 📦' },
  { value: 'entregado',     label: 'Entregado ✓' },
  { value: 'rechazado',     label: 'Cotización rechazada ✕' },
  { value: 'cancelado',     label: 'Cancelado' },
]

interface Props {
  open: boolean
  ticket: Ticket | null
  onClose: () => void
  onSaved: () => void
}

export default function TicketDetailModal({ open, ticket, onClose, onSaved }: Props) {
  const [status, setStatus] = useState('')
  const [note, setNote] = useState('')
  const [quote, setQuote] = useState<string>('')
  const [internalNotes, setInternalNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!ticket) return
    setStatus(ticket.status)
    setNote('')
    setQuote(ticket.quote_amount != null ? String(ticket.quote_amount) : '')
    setInternalNotes(ticket.internal_notes ?? '')
  }, [ticket, open])

  if (!ticket) return null

  async function handleSave() {
    if (!ticket) return
    setSaving(true)

    const updates: Record<string, unknown> = {}
    const statusChanged = status !== ticket.status
    const quoteValue = quote.trim() === '' ? null : parseFloat(quote)

    if (statusChanged || note.trim()) {
      const newEntry: StatusEntry = {
        status,
        at: new Date().toISOString(),
        by: 'operator',
        note: note.trim() || null,
      }
      updates.status_history = [...(ticket.status_history ?? []), newEntry]
    }
    if (statusChanged) updates.status = status
    if (quoteValue !== ticket.quote_amount) updates.quote_amount = quoteValue
    if (internalNotes !== (ticket.internal_notes ?? '')) updates.internal_notes = internalNotes || null

    if (Object.keys(updates).length === 0) {
      toast.info('No hay cambios para guardar')
      setSaving(false)
      return
    }

    updates.updated_at = new Date().toISOString()

    const { error } = await supabase.from('tickets').update(updates).eq('id', ticket.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Ticket actualizado')
    onSaved()
    onClose()
  }

  const statusLabel = (s: string) => STATUS_OPTIONS.find(o => o.value === s)?.label ?? s

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Orden {ticket.folio}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Cliente</p>
              <p className="font-medium">{ticket.customer_name ?? '—'}</p>
              <p className="text-xs font-mono text-muted-foreground">{ticket.customer_phone}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Equipo</p>
              <p className="font-medium">
                {[ticket.device_brand, ticket.device_model].filter(Boolean).join(' ') || '—'}
              </p>
              <p className="text-xs text-muted-foreground">{ticket.device_type ?? ''}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Problema reportado</p>
              <p className="text-sm">{ticket.problem_description ?? '—'}</p>
              {ticket.problem_category && (
                <Badge variant="outline" className="mt-1 text-xs">{ticket.problem_category}</Badge>
              )}
            </div>
          </div>

          {ticket.photos.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Fotos</p>
              <div className="flex flex-wrap gap-2">
                {ticket.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Foto ${i + 1}`} className="h-20 w-20 rounded object-cover border" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Actualizar status</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cotización (MXN)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={quote}
                  onChange={e => setQuote(e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nota para el cliente (se guarda en el historial)</Label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ej: Diagnóstico completo, requiere cambio de pantalla."
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas internas (no se muestran al cliente)</Label>
              <textarea
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-2">Historial</p>
            <div className="space-y-2">
              {[...ticket.status_history].reverse().map((entry, i) => (
                <div key={i} className="flex items-start gap-3 text-sm border-l-2 border-violet-200 pl-3 py-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{statusLabel(entry.status)}</span>
                      <Badge variant="outline" className="text-xs">{entry.by}</Badge>
                    </div>
                    {entry.note && <p className="text-muted-foreground mt-0.5">{entry.note}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(entry.at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
              {ticket.status_history.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin historial</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
