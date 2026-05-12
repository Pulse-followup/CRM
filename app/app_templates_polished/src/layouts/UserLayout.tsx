import { Outlet } from 'react-router-dom'
import AppTopBar from '../components/AppTopBar'

type UserLayoutProps = {
  onOpenGuide?: () => void
}

function UserLayout({ onOpenGuide }: UserLayoutProps) {
  return (
    <div className="app-shell">
      <AppTopBar onOpenGuide={onOpenGuide} />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

export default UserLayout
