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
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '16px 0',
        }}
      >
        <img
          src="/CRM/pulse-header-logo.png"
          alt="PULSE"
          style={{
            width: 76,
            height: 76,
            borderRadius: 18,
            objectFit: 'cover',
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          }}
        />
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