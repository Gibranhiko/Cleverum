import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ImagePlus, X } from 'lucide-react'

interface Producto {
  id?: string
  client_id: string
  name: string
  category: string
  description: string
  type: string
  includes: string
  image_url: string
}

function emptyForm(clientId: string): Producto {
  return { client_id: clientId, name: '', category: '', description: '', type: '', includes: '', image_url: '' }
}

interface Props {
  open: boolean
  clientId: string
  producto: Producto | null
  onClose: () => void
  onSaved: () => void
}

export default function ProductoModal({ open, clientId, producto, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Producto>(emptyForm(clientId))
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setForm(producto ?? emptyForm(clientId))
    setPreview(producto?.image_url || null)
    setError('')
  }, [producto, open, clientId])

  function set(field: keyof Producto, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${clientId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('products').upload(path, file, { upsert: true })
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path)
    set('image_url', publicUrl)
    setPreview(publicUrl)
    setUploading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    setLoading(true)
    setError('')
    const payload = { ...form, client_id: clientId }
    const { error: saveErr } = form.id
      ? await supabase.from('products').update(payload).eq('id', form.id)
      : await supabase.from('products').insert(payload)
    setLoading(false)
    if (saveErr) { setError(saveErr.message); return }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Ej. Pizza Margarita"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Input
                value={form.category}
                onChange={e => set('category', e.target.value)}
                placeholder="Pizzas, Bebidas..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Input
                value={form.type}
                onChange={e => set('type', e.target.value)}
                placeholder="individual, familiar..."
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Descripción</Label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Descripción del producto..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Incluye</Label>
              <Input
                value={form.includes}
                onChange={e => set('includes', e.target.value)}
                placeholder="Ej. Aderezo y servilletas"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Imagen</Label>
            {preview ? (
              <div className="relative w-fit">
                <img src={preview} alt="preview" className="h-32 w-32 object-cover rounded-lg border" />
                <button
                  type="button"
                  onClick={() => { setPreview(null); set('image_url', '') }}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-input rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                <ImagePlus size={24} />
                <span className="text-xs mt-1">{uploading ? 'Subiendo...' : 'Subir imagen'}</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading || uploading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
