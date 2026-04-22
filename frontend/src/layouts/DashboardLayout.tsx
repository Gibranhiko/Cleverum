import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navbar />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
