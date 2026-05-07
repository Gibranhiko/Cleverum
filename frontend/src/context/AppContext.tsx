import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Client {
  id: string
  company_name: string
  image_url: string | null
  bot_type: 'informativo' | 'catalogo' | 'leads' | 'servicios'
}

export interface UserProfile {
  id: string
  role: 'super_admin' | 'user'
  client_id: string | null
  allowed_pages: string[]
  full_name: string | null
}

interface AppContextType {
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  isPasswordRecovery: boolean
  clearPasswordRecovery: () => void
  selectedClient: Client | null
  setSelectedClient: (client: Client | null) => void
  notifications: number
  clearNotifications: () => void
  signOut: () => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [notifications, setNotifications] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function resolveSessionAndProfile(s: Session | null) {
      if (cancelled) return
      setSession(s)
      if (!s) {
        setProfile(null)
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, role, client_id, allowed_pages, full_name')
        .eq('id', s.user.id)
        .single()
      if (cancelled) return
      if (error || !data) {
        console.warn('[AppContext] No profile found for user', s.user.id, error)
        setProfile(null)
      } else {
        setProfile(data as UserProfile)
      }
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => resolveSessionAndProfile(s))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // PASSWORD_RECOVERY: Supabase creó una sesión válida porque el usuario
      // clickeó un recovery link. NO cargamos el profile ni dejamos pasar al
      // dashboard — el RouteGuard de App.tsx forzará /reset-password.
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
        setSession(s)
        setProfile(null)
        setLoading(false)
        return
      }
      // TOKEN_REFRESHED renueva el access_token sin cambiar de usuario.
      // No re-fetcheamos el profile ni mostramos el spinner — solo actualizamos session.
      if (event === 'TOKEN_REFRESHED') {
        setSession(s)
        return
      }
      setLoading(true)
      resolveSessionAndProfile(s)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  // Realtime: nuevas órdenes y leads del cliente seleccionado
  useEffect(() => {
    if (!selectedClient) return

    const channel = supabase
      .channel(`notifications-${selectedClient.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `client_id=eq.${selectedClient.id}`
      }, () => setNotifications(n => n + 1))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
        filter: `client_id=eq.${selectedClient.id}`
      }, () => setNotifications(n => n + 1))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedClient])

  async function signOut() {
    await supabase.auth.signOut()
    setSelectedClient(null)
    setIsPasswordRecovery(false)
  }

  return (
    <AppContext.Provider value={{
      session,
      profile,
      loading,
      isPasswordRecovery,
      clearPasswordRecovery: () => setIsPasswordRecovery(false),
      selectedClient,
      setSelectedClient,
      notifications,
      clearNotifications: () => setNotifications(0),
      signOut,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
