import { Outlet } from 'react-router-dom'
import AppTopBar from '../components/AppTopBar'

type AdminLayoutProps = {
  onOpenGuide?: () => void
}

function AdminLayout({ onOpenGuide }: AdminLayoutProps) {
  return (
    <div className="app-shell">
      <AppTopBar onOpenGuide={onOpenGuide} />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
