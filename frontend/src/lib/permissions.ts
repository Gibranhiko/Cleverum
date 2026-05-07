import type { UserProfile } from '@/context/AppContext'

export const PAGE_KEYS = [
  'dashboard',
  'clientes',
  'pedidos',
  'productos',
  'leads',
  'conversaciones',
  'reminders',
  'documentos',
  'config',
  'tickets',
  'servicios',
  'usuarios',
] as const

export type PageKey = typeof PAGE_KEYS[number]

// Páginas que solo super_admin puede ver. NO se ofrecen como opción
// asignable al crear/editar `user` profiles.
export const SUPER_ADMIN_ONLY_PAGES: PageKey[] = ['clientes', 'usuarios']

// Páginas que un user puede ver — base para el checkbox group del modal de usuarios
export const ASSIGNABLE_PAGES: PageKey[] = PAGE_KEYS.filter(
  p => !SUPER_ADMIN_ONLY_PAGES.includes(p as PageKey)
) as PageKey[]

export function canSee(page: PageKey, profile: UserProfile | null): boolean {
  if (!profile) return false
  if (profile.role === 'super_admin') return true
  if (SUPER_ADMIN_ONLY_PAGES.includes(page)) return false
  return profile.allowed_pages.includes(page)
}

export function landingPath(profile: UserProfile | null): string {
  if (!profile) return '/login'
  if (profile.role === 'super_admin') return '/dashboard'
  // user: primera página permitida en el orden de PAGE_KEYS
  const first = PAGE_KEYS.find(p => profile.allowed_pages.includes(p))
  return first ? `/${first}` : '/no-access'
}

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard:     'Dashboard',
  clientes:      'Clientes',
  pedidos:       'Pedidos',
  productos:     'Productos',
  leads:         'Leads',
  conversaciones:'Conversaciones',
  reminders:     'Reminders',
  documentos:    'Documentos',
  config:        'Config Bot',
  tickets:       'Tickets',
  servicios:     'Servicios',
  usuarios:      'Usuarios',
}
