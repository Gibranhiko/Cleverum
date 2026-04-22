import { NavLink, useNavigate } from 'react-router-dom'
import { Users, ShoppingBag, Package, UserCheck, Bell, MessageSquare, Clock, FileText, LogOut, LayoutDashboard, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { to: '/productos', label: 'Productos', icon: Package },
  { to: '/leads', label: 'Leads', icon: UserCheck },
  { to: '/conversaciones', label: 'Conversaciones', icon: MessageSquare },
  { to: '/reminders', label: 'Reminders', icon: Clock },
  { to: '/documentos', label: 'Documentos', icon: FileText },
  { to: '/config', label: 'Config Bot', icon: Settings },
]

export default function Navbar() {
  const navigate = useNavigate()
  const { notifications, clearNotifications } = useApp()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">Cleverum</h1>
        <p className="text-xs text-gray-500">Panel admin</p>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
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
          onClick={() => { clearNotifications(); navigate('/pedidos') }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Bell size={16} />
          Notificaciones
          {notifications > 0 && (
            <span className="ml-auto bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
