import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import AuthGuard from './components/AuthGuard'
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
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="productos" element={<Productos />} />
            <Route path="leads" element={<Leads />} />
            <Route path="conversaciones" element={<Conversaciones />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="documentos" element={<Documentos />} />
            <Route path="config" element={<ConfigBot />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
