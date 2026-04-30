import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'

function getRoleLabel(role: string) {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'finance':
      return 'Finance'
    case 'user':
    default:
      return 'User'
  }
}

function AppTopBar() {
  const { currentUser } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current) {
        return
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const roleLabel = getRoleLabel(currentUser.role)

  const menuItems = useMemo(() => {
    const primaryLabel = currentUser.role === 'admin' ? 'Dashboard' : 'Po?etna'

    return [
      { to: '/', label: primaryLabel },
      { to: '/settings', label: 'Pode?avanja' },
    ]
  }, [currentUser.role])

  return (
    <header className="app-topbar">
      <Link to="/" className="app-topbar-brand" aria-label="PULSE po?etna">
        <img src="/CRM/pulse-header-logo.png" alt="PULSE" className="app-topbar-logo" />
      </Link>

      <div className="app-topbar-user">
        <span className="app-topbar-role">{roleLabel}</span>
        <strong>{currentUser.name}</strong>
      </div>

      <div className="app-topbar-menu" ref={menuRef}>
        <button
          type="button"
          className={`app-topbar-toggle${isOpen ? ' is-open' : ''}`}
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label="Otvori meni"
        >
          <span />
          <span />
          <span />
        </button>

        {isOpen ? (
          <div className="app-topbar-dropdown" role="menu" aria-label="Glavni meni">
            {menuItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="app-topbar-link"
                role="menuitem"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export default AppTopBar
