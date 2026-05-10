import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FileUploadField } from '@/components/ui/file-upload-field'

interface Servicio {
  id?: string
  client_id?: string
  name: string
  description: string
  category: string
  price_amount: number | null
  price_label: string
  estimated_duration: string
  examples: string
  image_url: string
  is_active: boolean
  display_order: number
}

const empty: Servicio = {
  name: '',
  description: '',
  category: '',
  price_amount: null,
  price_label: '',
  estimated_duration: '',
  examples: '',
  image_url: '',
  is_active: true,
  display_order: 0,
}

interface Props {
  open: boolean
  clientId: string
  servicio: Servicio | null
  onClose: () => void
  onSaved: () => void
}

export default function ServicioModal({ open, clientId, servicio, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Servicio>(empty)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(servicio ?? empty)
    setError('')
  }, [servicio, open])

  function set<K extends keyof Servicio>(field: K, value: Servicio[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const ext = file.name.split('.').pop()
    const path = `${clientId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('services').upload(path, file, { upsert: true })
    if (upErr) {
      setError(`Error al subir imagen: ${upErr.message}`)
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('services').getPublicUrl(path)
    set('image_url', publicUrl)
    setUploading(false)
  }

  function clearImage() {
    set('image_url', '')
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('El nombre es requerido')
      return
    }
    setLoading(true)
    setError('')

    const payload = {
      client_id: clientId,
      name: form.name.trim(),
      description: form.description || null,
      category: form.category || null,
      price_amount: form.price_amount,
      price_label: form.price_label || null,
      estimated_duration: form.estimated_duration || null,
      examples: form.examples || null,
      image_url: form.image_url || null,
      is_active: form.is_active,
      display_order: form.display_order,
    }

    const { error: dbError } = form.id
      ? await supabase.from('services').update(payload).eq('id', form.id)
      : await supabase.from('services').insert(payload)

    setLoading(false)
    if (dbError) { setError(dbError.message); return }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ej. Cambio de pantalla iPhone"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Input
              value={form.category}
              onChange={e => set('category', e.target.value)}
              placeholder="Ej. Reparación, Mantenimiento, Accesorios"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Detalles del servicio"
              rows={3}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Ejemplos / casos de uso (opcional)</Label>
            <textarea
              value={form.examples}
              onChange={e => set('examples', e.target.value)}
              placeholder={'Ej:\n• Cambio de pantalla iPhone 13 — $1,800\n• Cambio de batería Galaxy S22 — $900'}
              rows={3}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Aparece en el bot debajo de la descripción cuando el cliente abre el detalle.
            </p>
          </div>

          <FileUploadField
            label="Imagen (opcional)"
            hint="Si subes imagen, se enviará junto con el detalle del servicio en WhatsApp."
            accept="image/*"
            variant="image"
            imageUrl={form.image_url || null}
            uploading={uploading}
            onFileSelected={file => {
              const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>
              handleImageUpload(fakeEvent)
            }}
            onClear={clearImage}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Precio (MXN)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.price_amount ?? ''}
                onChange={e => set('price_amount', e.target.value === '' ? null : parseFloat(e.target.value))}
                placeholder="500.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Etiqueta de precio</Label>
              <Input
                value={form.price_label}
                onChange={e => set('price_label', e.target.value)}
                placeholder="Desde $500 / Según diagnóstico"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground -mt-2">
            La etiqueta de precio aparece en el bot. Si está vacía, se usa el precio numérico.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duración estimada</Label>
              <Input
                value={form.estimated_duration}
                onChange={e => set('estimated_duration', e.target.value)}
                placeholder="2-3 días"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Orden de visualización</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={e => set('display_order', parseInt(e.target.value || '0', 10))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Switch
              checked={form.is_active}
              onCheckedChange={v => set('is_active', v)}
            />
            <Label className="cursor-pointer" onClick={() => set('is_active', !form.is_active)}>
              Servicio activo (visible en el bot)
            </Label>
          </div>

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
