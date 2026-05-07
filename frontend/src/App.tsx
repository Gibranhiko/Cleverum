import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import AuthGuard from './components/AuthGuard'
import PageGuard from './components/PageGuard'
import DefaultRedirect from './components/DefaultRedirect'
import DashboardLayout from './layouts/DashboardLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Pedidos from './pages/Pedidos'
import Productos from './pages/Productos'
import Leads from './pages/Leads'
import Conversaciones from './pages/Conversaciones'
import Reminders from './pages/Reminders'
import Documentos from './pages/Documentos'
import ConfigBot from './pages/ConfigBot'
import Usuarios from './pages/Usuarios'
import Servicios from './pages/Servicios'
import Tickets from './pages/Tickets'
import NoAccess from './pages/NoAccess'

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <DashboardLayout />
              </AuthGuard>
            }
          >
            <Route index element={<DefaultRedirect />} />
            <Route path="dashboard"      element={<PageGuard page="dashboard"><Dashboard /></PageGuard>} />
            <Route path="clientes"       element={<PageGuard page="clientes"><Clientes /></PageGuard>} />
            <Route path="pedidos"        element={<PageGuard page="pedidos"><Pedidos /></PageGuard>} />
            <Route path="productos"      element={<PageGuard page="productos"><Productos /></PageGuard>} />
            <Route path="leads"          element={<PageGuard page="leads"><Leads /></PageGuard>} />
            <Route path="conversaciones" element={<PageGuard page="conversaciones"><Conversaciones /></PageGuard>} />
            <Route path="reminders"      element={<PageGuard page="reminders"><Reminders /></PageGuard>} />
            <Route path="documentos"     element={<PageGuard page="documentos"><Documentos /></PageGuard>} />
            <Route path="config"         element={<PageGuard page="config"><ConfigBot /></PageGuard>} />
            <Route path="usuarios"       element={<PageGuard page="usuarios"><Usuarios /></PageGuard>} />
            <Route path="servicios"      element={<PageGuard page="servicios"><Servicios /></PageGuard>} />
            <Route path="tickets"        element={<PageGuard page="tickets"><Tickets /></PageGuard>} />
            <Route path="no-access"      element={<NoAccess />} />
          </Route>
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
