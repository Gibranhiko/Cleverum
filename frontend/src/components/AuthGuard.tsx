import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Button } from './ui/button'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, profile, profileError, loading, isPasswordRecovery, signOut, retryProfile } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Recovery flow: la sesión existe pero el usuario clickeó un recovery link.
  // Forzar la pantalla de reset antes de dejarlo entrar a la app.
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />

  if (!session) return <Navigate to="/login" replace />

  // Error real al fetchear el profile (red, RLS, db down) — recoverable
  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold">Error temporal</h1>
          <p className="text-sm text-muted-foreground">
            No pudimos cargar tu perfil. Puede ser un problema de conexión. Intenta de nuevo.
          </p>
          <p className="text-xs text-muted-foreground font-mono">{profileError}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={retryProfile}>Reintentar</Button>
            <Button onClick={signOut} variant="outline">Cerrar sesión</Button>
          </div>
        </div>
      </div>
    )
  }

  // Session OK, fetch OK, pero no hay row en user_profiles
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold">Cuenta sin configurar</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta aún no tiene un perfil asignado. Contacta al administrador para que te asigne acceso.
          </p>
          <Button onClick={signOut} variant="outline">Cerrar sesión</Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
