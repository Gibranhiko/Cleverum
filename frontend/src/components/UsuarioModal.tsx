import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ASSIGNABLE_PAGES, PAGE_LABELS, recommendedPages, type PageKey } from '@/lib/permissions'
import { CHATBOT_URL } from '@/lib/config'
import { supabase } from '@/lib/supabase'

interface UserRow {
  id: string
  email: string | null
  role: 'super_admin' | 'user'
  client_id: string | null
  allowed_pages: string[]
  full_name: string | null
}

interface ClientOption {
  id: string
  company_name: string
  bot_type: string
}

const BOT_LABELS: Record<string, string> = {
  informativo: 'Informativo + Citas',
  catalogo: 'Catálogo',
  leads: 'Leads',
  servicios: 'Servicios',
}

interface Props {
  open: boolean
  user: UserRow | null
  clients: ClientOption[]
  onClose: () => void
  onSaved: () => void
}

export default function UsuarioModal({ open, user, clients, onClose, onSaved }: Props) {
  const isEdit = !!user
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'super_admin' | 'user'>('user')
  const [clientId, setClientId] = useState('')
  const [allowedPages, setAllowedPages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    if (user) {
      setEmail(user.email ?? '')
      setPassword('')
      setFullName(user.full_name ?? '')
      setRole(user.role)
      setClientId(user.client_id ?? '')
      setAllowedPages(user.allowed_pages ?? [])
    } else {
      setEmail('')
      setPassword('')
      setFullName('')
      setRole('user')
      setClientId('')
      setAllowedPages([])
    }
  }, [user, open])

  function togglePage(page: PageKey) {
    setAllowedPages(curr =>
      curr.includes(page) ? curr.filter(p => p !== page) : [...curr, page]
    )
  }

  const selectedClient = clients.find(c => c.id === clientId)
  const botType = selectedClient?.bot_type

  // Auto-aplicar el preset recomendado al elegir cliente en un usuario NUEVO.
  // En edición no se toca (se respetan los permisos existentes).
  useEffect(() => {
    if (isEdit || role !== 'user' || !clientId) return
    setAllowedPages(recommendedPages(botType))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  function applyRecommended() {
    setAllowedPages(recommendedPages(botType))
  }

  async function handleSave() {
    setError('')
    if (!isEdit && (!email || !password)) {
      setError('Email y contraseña son requeridos')
      return
    }
    if (!isEdit && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (role === 'user' && !clientId) {
      setError('Selecciona un cliente para el usuario')
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Sesión expirada — inicia sesión de nuevo')
        return
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      }

      const payload = {
        full_name: fullName || null,
        role,
        client_id: role === 'super_admin' ? null : clientId,
        allowed_pages: role === 'super_admin' ? [] : allowedPages,
        ...(isEdit ? {} : { email, password }),
      }

      const url = isEdit ? `${CHATBOT_URL}/admin/users/${user.id}` : `${CHATBOT_URL}/admin/users`
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Error al guardar')
      }

      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-3">
            {!isEdit && (
              <>
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contraseña * (mín. 8 chars)</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Juan Pérez" />
            </div>
            <div className="space-y-1.5">
              <Label>Rol *</Label>
              <Select value={role} onValueChange={v => setRole(v as 'super_admin' | 'user')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario (cliente)</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {role === 'user' && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Páginas permitidas</Label>
                  <button
                    type="button"
                    onClick={applyRecommended}
                    disabled={!clientId}
                    className="text-xs text-violet-600 hover:underline disabled:opacity-40 disabled:no-underline"
                  >
                    ✨ Aplicar recomendadas
                  </button>
                </div>
                {botType && (
                  <p className="text-xs text-muted-foreground">
                    Bot del cliente: <span className="font-medium">{BOT_LABELS[botType] ?? botType}</span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-60 overflow-y-auto">
                  {ASSIGNABLE_PAGES.map(p => (
                    <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowedPages.includes(p)}
                        onChange={() => togglePage(p)}
                        className="cursor-pointer"
                      />
                      {PAGE_LABELS[p]}
                    </label>
                  ))}
                </div>
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
