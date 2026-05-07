import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { landingPath } from '../lib/permissions'

export default function DefaultRedirect() {
  const { profile } = useApp()
  return <Navigate to={landingPath(profile)} replace />
}
