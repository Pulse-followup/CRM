import { Outlet } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

const userNavItems = [{ to: '/tasks', label: 'Moji zadaci' }]

function UserLayout() {
  return (
    <div className="app-shell">
      <Sidebar items={userNavItems} />
      <div className="app-main">
        <Header
          title="Moji zadaci"
          subtitle="Execution screen za korisnika."
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default UserLayout
