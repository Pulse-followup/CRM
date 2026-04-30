import { Outlet } from 'react-router-dom'
import AppTopBar from '../components/AppTopBar'

function FinanceLayout() {
  return (
    <div className="app-shell">
      <AppTopBar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

export default FinanceLayout
