import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

interface Cliente {
  id?: string
  company_name: string
  company_type: string
  company_email: string
  company_address: string
  admin_name: string
  whatsapp_phone: string
  bot_type: 'informativo' | 'catalogo' | 'leads'
  facebook_link: string
  instagram_link: string
  wa_phone_number_id: string
  wa_access_token: string
  google_calendar_id: string
  bot_active: boolean
}

const empty: Cliente = {
  company_name: '',
  company_type: '',
  company_email: '',
  company_address: '',
  admin_name: '',
  whatsapp_phone: '',
  bot_type: 'informativo',
  facebook_link: '',
  instagram_link: '',
  wa_phone_number_id: '',
  wa_access_token: '',
  google_calendar_id: '',
  bot_active: true,
}

interface Props {
  open: boolean
  cliente: Cliente | null
  onClose: () => void
  onSaved: () => void
}

export default function ClienteModal({ open, cliente, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Cliente>(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(cliente ?? empty)
    setError('')
  }, [cliente, open])

  function set(field: keyof Cliente, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.company_name || !form.bot_type) {
      setError('Nombre y tipo de bot son requeridos')
      return
    }
    setLoading(true)
    setError('')

    const payload = { ...form }

    const { error } = form.id
      ? await supabase.from('clients').update(payload).eq('id', form.id)
      : await supabase.from('clients').insert(payload)

    setLoading(false)
    if (error) { setError(error.message); return }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info básica */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nombre de empresa *</Label>
              <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Ej. Restaurante El Buen Sabor" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de empresa</Label>
              <Input value={form.company_type} onChange={e => set('company_type', e.target.value)} placeholder="Restaurante, Clínica..." />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de bot *</Label>
              <Select value={form.bot_type} onValueChange={v => set('bot_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="informativo">Informativo + Citas</SelectItem>
                  <SelectItem value="catalogo">Catálogo + Pedidos</SelectItem>
                  <SelectItem value="leads">Ventas / Leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre del admin</Label>
              <Input value={form.admin_name} onChange={e => set('admin_name', e.target.value)} placeholder="Juan Pérez" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.company_email} onChange={e => set('company_email', e.target.value)} placeholder="contacto@empresa.com" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Dirección</Label>
              <Input value={form.company_address} onChange={e => set('company_address', e.target.value)} placeholder="Calle, Ciudad" />
            </div>
          </div>

          <Separator />

          {/* Redes sociales */}
          <p className="text-sm font-medium text-muted-foreground">Redes sociales</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Facebook</Label>
              <Input value={form.facebook_link} onChange={e => set('facebook_link', e.target.value)} placeholder="facebook.com/empresa" />
            </div>
            <div className="space-y-1.5">
              <Label>Instagram</Label>
              <Input value={form.instagram_link} onChange={e => set('instagram_link', e.target.value)} placeholder="instagram.com/empresa" />
            </div>
          </div>

          <Separator />

          {/* Credenciales WhatsApp */}
          <p className="text-sm font-medium text-muted-foreground">WhatsApp Cloud API</p>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label>Número de WhatsApp</Label>
              <Input value={form.whatsapp_phone} onChange={e => set('whatsapp_phone', e.target.value)} placeholder="+52 55 1234 5678" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number ID (Meta)</Label>
              <Input value={form.wa_phone_number_id} onChange={e => set('wa_phone_number_id', e.target.value)} placeholder="ID del número en Meta" />
            </div>
            <div className="space-y-1.5">
              <Label>Access Token (Meta)</Label>
              <Input value={form.wa_access_token} onChange={e => set('wa_access_token', e.target.value)} placeholder="Token de acceso de Meta" />
            </div>
          </div>

          {form.bot_type === 'informativo' && (
            <>
              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Google Calendar</p>
              <div className="space-y-1.5">
                <Label>Calendar ID</Label>
                <Input value={form.google_calendar_id} onChange={e => set('google_calendar_id', e.target.value)} placeholder="ID del calendario de Google" />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
