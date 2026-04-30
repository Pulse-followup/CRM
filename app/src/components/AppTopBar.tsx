import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'

function roleLabel(role: string) {
  if (role === 'admin') return 'ADMIN'
  if (role === 'finance') return 'FINANCE'
  return 'USER'
}

function AppTopBar() {
  const { currentUser } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [])

  return (
    <header className="pulse-topbar">
      <Link to="/" className="pulse-logo-wrap" aria-label="PULSE home">
        <img src="/CRM/pulse-header-logo.png" alt="PULSE" className="pulse-logo" />
      </Link>
      <div className="pulse-role">{roleLabel(currentUser.role)}</div>
      <div className="pulse-menu" ref={menuRef}>
        <button className="pulse-hamburger" type="button" onClick={() => setIsOpen((v) => !v)} aria-label="Meni">
          <span />
          <span />
          <span />
        </button>
        {isOpen ? (
          <div className="pulse-dropdown">
            <Link to="/settings" onClick={() => setIsOpen(false)}>Podešavanja</Link>
            <Link to="/" onClick={() => setIsOpen(false)}>Home</Link>
          </div>
        ) : null}
      </div>
    </header>
  )
}

export default AppTopBar
