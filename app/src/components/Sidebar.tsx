import { NavLink } from 'react-router-dom'

type NavItem = {
  to: string
  label: string
}

type SidebarProps = {
  items: NavItem[]
}

function Sidebar({ items }: SidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <img
          src="/CRM/pulse-logo.png"
          alt="PULSE"
          className="app-brand-logo"
        />
        <div className="app-brand-text">
          <span className="app-brand-title">PULSE</span>
          <strong>CRM</strong>
        </div>
      </div>

      <nav className="app-nav" aria-label="Glavna navigacija">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `app-nav-link${isActive ? ' is-active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar