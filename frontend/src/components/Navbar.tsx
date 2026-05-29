import { NavLink, useNavigate } from 'react-router-dom'
import {
  Users, ShoppingBag, Package, UserCheck, Bell, MessageSquare,
  Clock, FileText, LogOut, LayoutDashboard, Settings, Wrench, Receipt, UserCog,
  CalendarDays, CalendarCog,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { canSee, type PageKey } from '../lib/permissions'
import wabbiLogo from '@/assets/logos/wabbi-logo.png'

const links: { to: string; label: string; page: PageKey; icon: typeof Users }[] = [
  { to: '/dashboard',      label: 'Dashboard',      page: 'dashboard',      icon: LayoutDashboard },
  { to: '/clientes',       label: 'Clientes',       page: 'clientes',       icon: Users },
  { to: '/usuarios',       label: 'Usuarios',       page: 'usuarios',       icon: UserCog },
  { to: '/pedidos',        label: 'Pedidos',        page: 'pedidos',        icon: ShoppingBag },
  { to: '/productos',      label: 'Productos',      page: 'productos',      icon: Package },
  { to: '/leads',          label: 'Leads',          page: 'leads',          icon: UserCheck },
  { to: '/conversaciones', label: 'Conversaciones', page: 'conversaciones', icon: MessageSquare },
  { to: '/tickets',        label: 'Tickets',        page: 'tickets',        icon: Receipt },
  { to: '/citas',          label: 'Citas',          page: 'citas',          icon: CalendarDays },
  { to: '/servicios',      label: 'Servicios',      page: 'servicios',      icon: Wrench },
  { to: '/config-citas',   label: 'Config Citas',   page: 'config_citas',   icon: CalendarCog },
  { to: '/reminders',      label: 'Reminders',      page: 'reminders',      icon: Clock },
  { to: '/documentos',     label: 'Documentos',     page: 'documentos',     icon: FileText },
  { to: '/config',         label: 'Config Bot',     page: 'config',         icon: Settings },
]

export default function Navbar() {
  const navigate = useNavigate()
  const { profile, notifications, clearNotifications, signOut } = useApp()

  const visibleLinks = links.filter(l => canSee(l.page, profile))

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col shadow-[2px_0_8px_0_rgba(0,0,0,0.05)]">
      <div className="px-4 py-5 border-b border-gray-200 flex items-center gap-2.5">
        <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
          <img src={wabbiLogo} alt="Wabbi" className="h-8 w-8 object-contain" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 leading-tight">Wabbi</h1>
          <p className="text-xs text-gray-500 truncate">
            {profile?.role === 'super_admin' ? 'Panel admin' : profile?.full_name ?? 'Panel'}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {visibleLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-violet-50 text-violet-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-4 border-t border-gray-200 space-y-0.5">
        <button
          onClick={clearNotifications}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Bell size={16} />
          Notificaciones
          {notifications > 0 && (
            <span className="ml-auto bg-violet-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {notifications}
            </span>
          )}
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
