import { Outlet } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/tasks', label: 'Zadaci' },
  { to: '/clients', label: 'Klijenti' },
  { to: '/projects', label: 'Projekti' },
  { to: '/billing', label: 'Naplata' },
  { to: '/settings', label: 'Podešavanja' },
]

function AdminLayout() {
  return (
    <div className="app-shell">
      <Sidebar items={adminNavItems} />
      <div className="app-main">
        <Header
          title="PULSE Admin"
          subtitle="Workspace shell spreman za migraciju modula iz legacy aplikacije."
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
