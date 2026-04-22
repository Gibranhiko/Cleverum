import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Client {
  id: string
  company_name: string
  image_url: string | null
  bot_type: 'informativo' | 'catalogo' | 'leads'
}

interface AppContextType {
  session: Session | null
  loading: boolean
  selectedClient: Client | null
  setSelectedClient: (client: Client | null) => void
  notifications: number
  clearNotifications: () => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [notifications, setNotifications] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
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

  return (
    <AppContext.Provider value={{
      session,
      loading,
      selectedClient,
      setSelectedClient,
      notifications,
      clearNotifications: () => setNotifications(0)
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
