import { Outlet } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

const financeNavItems = [{ to: '/billing', label: 'Naplata' }]

function FinanceLayout() {
  return (
    <div className="app-shell">
      <Sidebar items={financeNavItems} />
      <div className="app-main">
        <Header
          title="Naplata"
          subtitle="Finance pregled spreman za migraciju billing modula."
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default FinanceLayout
