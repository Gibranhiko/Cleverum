import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <>{children}</>
}
