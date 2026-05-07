import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { canSee, landingPath, type PageKey } from '../lib/permissions'

export default function PageGuard({ page, children }: { page: PageKey; children: React.ReactNode }) {
  const { profile } = useApp()

  if (canSee(page, profile)) return <>{children}</>

  return <Navigate to={landingPath(profile)} replace />
}
