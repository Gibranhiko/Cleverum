import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import UsuarioModal from '@/components/UsuarioModal'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CHATBOT_URL } from '@/lib/config'
import { PAGE_LABELS, type PageKey } from '@/lib/permissions'
import { useApp } from '@/context/AppContext'

interface UserRow {
  id: string
  email: string | null
  role: 'super_admin' | 'user'
  client_id: string | null
  allowed_pages: string[]
  full_name: string | null
  created_at: string
}

interface ClientOption {
  id: string
  company_name: string
}

export default function Usuarios() {
  const { profile } = useApp()
  const [users, setUsers] = useState<UserRow[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function loadUsers() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`${CHATBOT_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Error al cargar usuarios')
      }
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (err: any) {
      toast.error(err.message ?? 'Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  async function loadClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name')
      .order('company_name')
    if (error) {
      toast.error(error.message)
      return
    }
    setClients((data ?? []) as ClientOption[])
  }

  useEffect(() => {
    loadUsers()
    loadClients()
  }, [])

  async function handleDelete() {
    if (!deleteId) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${CHATBOT_URL}/admin/users/${deleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Error al eliminar')
      }
      toast.success('Usuario eliminado')
      setDeleteId(null)
      loadUsers()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al eliminar')
    }
  }

  const clientNameMap = new Map(clients.map(c => [c.id, c.company_name]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona quién accede al panel y qué páginas ve cada uno.
          </p>
        </div>
        <Button onClick={() => { setEditUser(null); setModalOpen(true) }}>
          <Plus size={16} className="mr-2" />
          Nuevo usuario
        </Button>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Páginas</TableHead>
              <TableHead className="w-32">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            )}
            {!loading && users.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay usuarios</TableCell></TableRow>
            )}
            {!loading && users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.email ?? '—'}</TableCell>
                <TableCell>{u.full_name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={u.role === 'super_admin' ? 'default' : 'secondary'}>
                    {u.role === 'super_admin' ? 'Super Admin' : 'Usuario'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.client_id ? clientNameMap.get(u.client_id) ?? u.client_id : '—'}
                </TableCell>
                <TableCell>
                  {u.role === 'super_admin' ? (
                    <span className="text-xs text-muted-foreground">Todas</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {u.allowed_pages.length === 0
                        ? <span className="text-xs text-muted-foreground">Ninguna</span>
                        : u.allowed_pages.map(p => (
                          <Badge key={p} variant="outline" className="text-xs">
                            {PAGE_LABELS[p as PageKey] ?? p}
                          </Badge>
                        ))
                      }
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditUser(u); setModalOpen(true) }}>
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteId(u.id)}
                      disabled={u.id === profile?.id}
                      title={u.id === profile?.id ? 'No puedes eliminar tu propio usuario' : 'Eliminar'}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <UsuarioModal
        open={modalOpen}
        user={editUser}
        clients={clients}
        onClose={() => setModalOpen(false)}
        onSaved={loadUsers}
      />

      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar usuario?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción es irreversible. El usuario perderá acceso inmediato al panel.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
