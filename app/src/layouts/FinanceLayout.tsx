import { Outlet } from 'react-router-dom'
import AppTopBar from '../components/AppTopBar'

type FinanceLayoutProps = {
  onOpenGuide?: () => void
}

function FinanceLayout({ onOpenGuide }: FinanceLayoutProps) {
  return (
    <div className="app-shell">
      <AppTopBar onOpenGuide={onOpenGuide} />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

export default FinanceLayout
