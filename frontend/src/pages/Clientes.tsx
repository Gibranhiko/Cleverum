import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import ClienteModal from '@/components/ClienteModal'
import { Plus, Pencil, Trash2, Bot } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 15

interface Cliente {
  id: string
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
  is_active: boolean
}

const botTypeLabel = {
  informativo: 'Informativo',
  catalogo: 'Catálogo',
  leads: 'Leads',
}

const botTypeColor: Record<string, 'default' | 'secondary' | 'outline'> = {
  informativo: 'default',
  catalogo: 'secondary',
  leads: 'outline',
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editCliente, setEditCliente] = useState<Cliente | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchClientes() {
    setLoading(true)
    const from = page * PAGE_SIZE
    const { data, count } = await supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    setClientes(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  useEffect(() => { fetchClientes() }, [page])

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('clients').delete().eq('id', deleteId)
    setDeleteId(null)
    setDeleting(false)
    if (error) { toast.error('Error al eliminar el cliente'); return }
    toast.success('Cliente eliminado')
    fetchClientes()
  }

  async function toggleBot(id: string, current: boolean) {
    const { error } = await supabase.from('clients').update({ bot_active: !current }).eq('id', id)
    if (error) { toast.error('Error al cambiar estado del bot'); return }
    toast.success(current ? 'Bot desactivado' : 'Bot activado')
    fetchClientes()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Clientes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} registrado{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => { setEditCliente(null); setModalOpen(true) }}>
          <Plus size={16} className="mr-1.5" />
          Nuevo cliente
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Tipo de bot</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Bot</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-32 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-20 bg-muted rounded-full animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-28 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))}
              </>
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No hay clientes. Crea el primero.
                </TableCell>
              </TableRow>
            ) : clientes.map(c => (
              <TableRow key={c.id}>
                <TableCell>
                  <p className="font-medium">{c.company_name}</p>
                  {c.company_type && <p className="text-xs text-muted-foreground">{c.company_type}</p>}
                </TableCell>
                <TableCell>
                  <Badge variant={botTypeColor[c.bot_type]}>
                    {botTypeLabel[c.bot_type]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{c.whatsapp_phone || '—'}</TableCell>
                <TableCell className="text-sm">{c.admin_name || '—'}</TableCell>
                <TableCell>
                  <button
                    onClick={() => toggleBot(c.id, c.bot_active)}
                    title={c.bot_active ? 'Bot activo — click para desactivar' : 'Bot inactivo — click para activar'}
                    aria-label={c.bot_active ? 'Desactivar bot' : 'Activar bot'}
                    className="cursor-pointer"
                  >
                    <Bot
                      size={18}
                      className={c.bot_active ? 'text-emerald-500' : 'text-muted-foreground'}
                    />
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar cliente"
                      onClick={() => { setEditCliente(c); setModalOpen(true) }}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar cliente"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(c.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t text-sm text-muted-foreground">
            <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}</span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>Siguiente</Button>
            </div>
          </div>
        )}
      </div>

      <ClienteModal
        open={modalOpen}
        cliente={editCliente}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          toast.success(editCliente ? 'Cliente actualizado' : 'Cliente creado')
          fetchClientes()
        }}
      />

      {/* Confirmar eliminación */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar cliente?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción eliminará al cliente y todos sus datos asociados (productos, pedidos, leads). No se puede deshacer.
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
