import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/formatters'

interface HistoryMsg {
  role: 'user' | 'assistant'
  content: string
}

export interface LeadData {
  id: string
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

const statusConfig: Record<LeadData['status'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  new: { label: 'Nuevo', variant: 'default' },
  contacted: { label: 'Contactado', variant: 'secondary' },
  qualified: { label: 'Calificado', variant: 'outline' },
  lost: { label: 'Perdido', variant: 'destructive' },
  won: { label: 'Ganado', variant: 'default' },
}

const statusOptions: LeadData['status'][] = ['new', 'contacted', 'qualified', 'lost', 'won']

interface LeadDetailModalProps {
  lead: LeadData | null
  onClose: () => void
  onUpdateStatus: (id: string, status: LeadData['status']) => void
  onUpdateNotes: (id: string, notes: string) => void
}

export default function LeadDetailModal({ lead, onClose, onUpdateStatus, onUpdateNotes }: LeadDetailModalProps) {
  const [notesDirty, setNotesDirty] = useState(false)

  function handleClose() {
    if (notesDirty && !confirm('Tienes notas sin guardar. ¿Cerrar de todas formas?')) return
    setNotesDirty(false)
    onClose()
  }

  return (
    <Dialog open={!!lead} onOpenChange={open => { if (!open) handleClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del lead</DialogTitle>
        </DialogHeader>
        {lead && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-muted-foreground">Nombre</span>
              <span className="font-medium">{lead.customer_name || '—'}</span>
              <span className="text-muted-foreground">Teléfono</span>
              <span>{lead.customer_phone || '—'}</span>
              <span className="text-muted-foreground">Empresa</span>
              <span>{lead.company || '—'}</span>
              <span className="text-muted-foreground">Necesidad</span>
              <span>{lead.need || '—'}</span>
              <span className="text-muted-foreground">Presupuesto</span>
              <span>{lead.budget_range || '—'}</span>
              <span className="text-muted-foreground">Timeline</span>
              <span>{lead.timeline || '—'}</span>
              <span className="text-muted-foreground">Fecha</span>
              <span>{formatDate(lead.created_at)}</span>
            </div>

            <div className="space-y-1.5">
              <p className="text-muted-foreground">Estado</p>
              <Select value={lead.status} onValueChange={v => onUpdateStatus(lead.id, v as LeadData['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                initial={lead.notes}
                onSave={notes => { onUpdateNotes(lead.id, notes); setNotesDirty(false) }}
                onDirtyChange={setNotesDirty}
              />
            </div>

            {lead.raw_conversation && lead.raw_conversation.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-muted-foreground font-medium">Conversación completa</p>
                <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border p-3 bg-muted/30">
                  {lead.raw_conversation.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs ${msg.role === 'user' ? 'bg-background border' : 'bg-primary text-primary-foreground'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function NoteEditor({ initial, onSave, onDirtyChange }: {
  initial: string
  onSave: (v: string) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [value, setValue] = useState(initial || '')
  const [saved, setSaved] = useState(true)

  function handleChange(v: string) {
    setValue(v)
    setSaved(false)
    onDirtyChange?.(true)
  }

  function handleSave() {
    onSave(value)
    setSaved(true)
    onDirtyChange?.(false)
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={e => handleChange(e.target.value)}
        rows={4}
        placeholder="Agrega notas sobre este lead..."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
      />
      <Button size="sm" variant={saved ? 'outline' : 'default'} onClick={handleSave} disabled={saved}>
        {saved ? 'Guardado' : 'Guardar notas'}
      </Button>
    </div>
  )
}
