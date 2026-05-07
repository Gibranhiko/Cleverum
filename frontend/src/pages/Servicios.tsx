import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import ServicioModal from '@/components/ServicioModal'
import { Plus, Pencil, Trash2, Wrench, Search } from 'lucide-react'
import { toast } from 'sonner'

interface Cliente {
  id: string
  company_name: string
  bot_type: string
}

interface Servicio {
  id: string
  client_id: string
  name: string
  description: string
  category: string
  price_amount: number | null
  price_label: string
  estimated_duration: string
  is_active: boolean
  display_order: number
}

export default function Servicios() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState<string>('')
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editServicio, setEditServicio] = useState<Servicio | null>(null)
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
        const first = list.find(c => c.bot_type === 'servicios') ?? list[0]
        if (first) setClienteId(first.id)
      })
  }, [])

  useEffect(() => {
    if (!clienteId) return
    fetchServicios()
  }, [clienteId])

  async function fetchServicios() {
    setLoading(true)
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('client_id', clienteId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      toast.error('Error al cargar servicios')
      setLoading(false)
      return
    }
    setServicios((data ?? []) as Servicio[])
    setLoading(false)
  }

  async function toggleActive(s: Servicio) {
    const { error } = await supabase
      .from('services')
      .update({ is_active: !s.is_active })
      .eq('id', s.id)
    if (error) { toast.error('Error al actualizar'); return }
    fetchServicios()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('services').delete().eq('id', deleteId)
    setDeleteId(null)
    setDeleting(false)
    if (error) { toast.error('Error al eliminar'); return }
    toast.success('Servicio eliminado')
    fetchServicios()
  }

  const selectedCliente = clientes.find(c => c.id === clienteId)
  const categories = Array.from(new Set(servicios.map(s => s.category).filter(Boolean)))

  const filtered = servicios.filter(s => {
    const matchesSearch = !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Servicios</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} servicio{filtered.length !== 1 ? 's' : ''}
            {servicios.length !== filtered.length && ` (de ${servicios.length})`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={clienteId} onValueChange={v => { setClienteId(v); setSearch(''); setCategoryFilter('all') }}>
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
            onClick={() => { setEditServicio(null); setModalOpen(true) }}
            disabled={!clienteId}
          >
            <Plus size={16} className="mr-1.5" />
            Nuevo servicio
          </Button>
        </div>
      </div>

      {selectedCliente && selectedCliente.bot_type !== 'servicios' && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Este cliente tiene bot tipo <strong>{selectedCliente.bot_type}</strong>. Los servicios se usan principalmente en bots tipo <strong>Servicios</strong>.
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o categoría..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead className="w-24">Activo</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!clienteId ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Selecciona un cliente para ver sus servicios.
                </TableCell>
              </TableRow>
            ) : loading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-40 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-20 bg-muted rounded-full animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-10 bg-muted rounded-full animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))}
              </>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Wrench size={32} className="mx-auto mb-2 opacity-30" />
                  {servicios.length === 0 ? 'No hay servicios. Crea el primero.' : 'No hay servicios que coincidan con los filtros.'}
                </TableCell>
              </TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id}>
                <TableCell>
                  <p className="font-medium">{s.name}</p>
                  {s.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{s.description}</p>
                  )}
                </TableCell>
                <TableCell>
                  {s.category && <Badge variant="secondary">{s.category}</Badge>}
                </TableCell>
                <TableCell className="text-sm">
                  {s.price_label || (s.price_amount != null ? `$${s.price_amount}` : '—')}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.estimated_duration || '—'}</TableCell>
                <TableCell>
                  <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditServicio(s); setModalOpen(true) }}>
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(s.id)}
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
        <ServicioModal
          open={modalOpen}
          clientId={clienteId}
          servicio={editServicio}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            toast.success(editServicio ? 'Servicio actualizado' : 'Servicio creado')
            fetchServicios()
          }}
        />
      )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar servicio?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción eliminará el servicio permanentemente. No se puede deshacer.
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
