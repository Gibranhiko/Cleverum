import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { useNavigate } from 'react-router-dom'

export default function NoAccess() {
  const { signOut } = useApp()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto px-6">
      <h1 className="text-2xl font-semibold mb-2">Sin acceso a ninguna sección</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Tu cuenta aún no tiene páginas asignadas. Contacta al administrador para que te dé acceso a las secciones que necesitas.
      </p>
      <Button variant="outline" onClick={handleLogout}>Cerrar sesión</Button>
    </div>
  )
}
