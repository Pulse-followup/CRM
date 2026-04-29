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
      
      {/* 🔥 NOVI HEADER SA VELIKIM LOGOM */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "16px 0"
        }}
      >
        <img
          src="/CRM/pulse-logo.png"
          alt="PULSE"
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
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