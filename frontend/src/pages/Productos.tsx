import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import ProductoModal from '@/components/ProductoModal'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'

interface Cliente {
  id: string
  company_name: string
  bot_type: string
}

interface Producto {
  id: string
  client_id: string
  name: string
  category: string
  description: string
  type: string
  includes: string
  image_url: string
}

export default function Productos() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState<string>('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editProducto, setEditProducto] = useState<Producto | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, company_name, bot_type')
      .eq('is_active', true)
      .order('company_name')
      .then(({ data }) => {
        const list = data ?? []
        setClientes(list)
        const first = list.find(c => c.bot_type === 'catalogo') ?? list[0]
        if (first) setClienteId(first.id)
      })
  }, [])

  useEffect(() => {
    if (!clienteId) return
    fetchProductos()
  }, [clienteId])

  async function fetchProductos() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('client_id', clienteId)
      .order('category')
    setProductos(data ?? [])
    setLoading(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('products').delete().eq('id', deleteId)
    setDeleteId(null)
    setDeleting(false)
    fetchProductos()
  }

  const selectedCliente = clientes.find(c => c.id === clienteId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Productos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {productos.length} producto{productos.length !== 1 ? 's' : ''} registrado{productos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => { setEditProducto(null); setModalOpen(true) }}
            disabled={!clienteId}
          >
            <Plus size={16} className="mr-1.5" />
            Nuevo producto
          </Button>
        </div>
      </div>

      {selectedCliente && selectedCliente.bot_type !== 'catalogo' && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Este cliente tiene bot tipo <strong>{selectedCliente.bot_type}</strong>. Los productos son principalmente para bots tipo <strong>Catálogo</strong>.
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Imagen</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!clienteId ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Selecciona un cliente para ver sus productos.
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : productos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  No hay productos. Crea el primero.
                </TableCell>
              </TableRow>
            ) : productos.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-10 w-10 rounded-md object-cover border"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                      <Package size={16} className="text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{p.name}</p>
                  {p.includes && <p className="text-xs text-muted-foreground">{p.includes}</p>}
                </TableCell>
                <TableCell>
                  {p.category && <Badge variant="secondary">{p.category}</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.type || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {p.description || '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setEditProducto(p); setModalOpen(true) }}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(p.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {clienteId && (
        <ProductoModal
          open={modalOpen}
          clientId={clienteId}
          producto={editProducto}
          onClose={() => setModalOpen(false)}
          onSaved={fetchProductos}
        />
      )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar producto?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción eliminará el producto permanentemente. No se puede deshacer.
          </p>
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
