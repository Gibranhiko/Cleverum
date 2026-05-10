import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { FileUploadField } from '@/components/ui/file-upload-field'
import { useApp } from '@/context/AppContext'

interface Cliente {
  id?: string
  company_name: string
  company_type: string
  company_email: string
  company_address: string
  admin_name: string
  whatsapp_phone: string
  bot_type: 'informativo' | 'catalogo' | 'leads' | 'servicios'
  facebook_link: string
  instagram_link: string
  wa_phone_number_id: string
  wa_access_token: string
  google_calendar_id: string
  google_calendar_key_url: string
  mascot_name: string
  mascot_image_url: string
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
  google_calendar_key_url: '',
  mascot_name: '',
  mascot_image_url: '',
  bot_active: true,
}

interface Props {
  open: boolean
  cliente: Cliente | null
  onClose: () => void
  onSaved: () => void
}

export default function ClienteModal({ open, cliente, onClose, onSaved }: Props) {
  const { profile } = useApp()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [form, setForm] = useState<Cliente>(empty)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [uploadingMascot, setUploadingMascot] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(cliente ?? empty)
    setKeyFile(null)
    setError('')
  }, [cliente, open])

  function set(field: keyof Cliente, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleMascotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) {
      setError('La imagen debe pesar menos de 1MB. Comprime con tinypng.com o squoosh.app')
      return
    }

    if (!form.id) {
      setError('Guarda el cliente primero antes de subir la mascota')
      return
    }

    setUploadingMascot(true)
    setError('')
    const ext = file.name.split('.').pop()
    const path = `${form.id}/mascot.${ext}`
    const { error: upErr } = await supabase.storage
      .from('services')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (upErr) {
      setError(`Error al subir mascota: ${upErr.message}`)
      setUploadingMascot(false)
      return
    }

    // Cache busting via timestamp query — el browser y WhatsApp ven la nueva imagen
    const { data: { publicUrl } } = supabase.storage.from('services').getPublicUrl(path)
    set('mascot_image_url', `${publicUrl}?v=${Date.now()}`)
    setUploadingMascot(false)
  }

  function clearMascot() {
    set('mascot_image_url', '')
  }

  async function handleSave() {
    if (!form.company_name || !form.bot_type) {
      setError('Nombre y tipo de bot son requeridos')
      return
    }
    setLoading(true)
    setError('')

    const payload = { ...form }
    let clientId = form.id

    if (form.id) {
      const { error: updateError } = await supabase.from('clients').update(payload).eq('id', form.id)
      if (updateError) { setLoading(false); setError(updateError.message); return }
    } else {
      const { data, error: insertError } = await supabase.from('clients').insert(payload).select().single()
      if (insertError || !data) { setLoading(false); setError(insertError?.message ?? 'Error al guardar'); return }
      clientId = data.id
    }

    if (keyFile && clientId) {
      const path = `${clientId}/service-account.json`
      const { error: uploadError } = await supabase.storage
        .from('calendar-keys')
        .upload(path, keyFile, { upsert: true })
      if (uploadError) {
        setLoading(false)
        setError(`Cliente guardado pero falló la subida del JSON: ${uploadError.message}`)
        return
      }
      await supabase.from('clients').update({ google_calendar_key_url: path }).eq('id', clientId)
    }

    setLoading(false)
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
                  <SelectItem value="servicios">Servicios + Tickets</SelectItem>
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

          {isSuperAdmin && (
            <>
              <Separator />

              {/* Credenciales WhatsApp — solo super_admin */}
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
            </>
          )}

          {isSuperAdmin && (
            <>
              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Asesor virtual</p>
              <p className="text-xs text-muted-foreground -mt-2">
                Configura una mascota o personaje. Aparecerá la primera vez que un cliente inicie conversación con el bot.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nombre del asesor</Label>
                  <Input
                    value={form.mascot_name}
                    onChange={e => set('mascot_name', e.target.value)}
                    placeholder="Ej. Ribo, Sofía, Toto"
                  />
                </div>
                <FileUploadField
                  label="Imagen del asesor"
                  hint="PNG transparente recomendado, máx 1MB. Tip: comprime con tinypng.com"
                  accept="image/png,image/jpeg,image/webp"
                  variant="image"
                  imageUrl={form.mascot_image_url || null}
                  uploading={uploadingMascot}
                  disabled={!form.id}
                  disabledHint="Guarda el cliente primero, después puedes subir la mascota editándolo."
                  onFileSelected={file => {
                    const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>
                    handleMascotUpload(fakeEvent)
                  }}
                  onClear={clearMascot}
                />
              </div>
            </>
          )}

          {isSuperAdmin && form.bot_type === 'informativo' && (
            <>
              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Google Calendar</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Calendar ID</Label>
                  <Input value={form.google_calendar_id} onChange={e => set('google_calendar_id', e.target.value)} placeholder="ID del calendario de Google" />
                </div>
                <FileUploadField
                  label="Service Account JSON"
                  accept=".json,application/json"
                  variant="file"
                  fileName={keyFile?.name}
                  fileExists={!keyFile && !!form.google_calendar_key_url}
                  onFileSelected={file => setKeyFile(file)}
                />
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
