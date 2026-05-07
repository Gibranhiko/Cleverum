import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/context/AppContext'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { session, isPasswordRecovery, clearPasswordRecovery, signOut } = useApp()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Si llegan acá sin sesión activa (ej: link expiró), no pueden hacer reset.
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-xl font-semibold">Link de recuperación inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este link ya expiró o fue usado. Pide otro al administrador.
          </p>
          <Button onClick={() => navigate('/login')}>Ir al login</Button>
        </div>
      </div>
    )
  }

  // Si no hay flag de recovery activa, redirigir — esta pantalla es solo
  // accesible vía recovery link.
  if (!isPasswordRecovery) {
    navigate('/dashboard', { replace: true })
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    // Password actualizada — limpiar flag y entrar al dashboard.
    clearPasswordRecovery()
    navigate('/dashboard', { replace: true })
  }

  async function handleCancel() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-sm w-full bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Establece tu nueva contraseña</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estás cambiando la contraseña para <strong>{session.user.email}</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nueva contraseña</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar contraseña</Label>
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repite la contraseña"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Cambiar contraseña'}
            </Button>
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={loading}>
              Cancelar y cerrar sesión
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
