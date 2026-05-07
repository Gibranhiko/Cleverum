import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Button } from './ui/button'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, signOut } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // Session OK pero el usuario no tiene profile en user_profiles
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
