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
        <span className="app-brand-badge">PULSE</span>
        <strong>CRM</strong>
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
