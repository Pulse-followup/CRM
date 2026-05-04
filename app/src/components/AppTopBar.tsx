import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'

function roleLabel(role: string) {
  if (role === 'admin') return 'ADMIN'
  if (role === 'finance') return 'FINANCE'
  return 'USER'
}

type AppTopBarProps = {
  onOpenGuide?: () => void
}

function AppTopBar({ onOpenGuide }: AppTopBarProps) {
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
      <nav className="pulse-desktop-side-nav" aria-label="Desktop navigacija">
        <Link to="/">Home</Link>
        <Link to="/settings">Moj nalog</Link>
        {currentUser.role === 'admin' ? <Link to="/products">Moji proizvodi</Link> : null}
        {currentUser.role === 'admin' ? <Link to="/templates">Procesi</Link> : null}
        <button type="button" onClick={onOpenGuide}>Kako koristiti PULSE</button>
      </nav>
      <div className="pulse-menu" ref={menuRef}>
        <button className="pulse-hamburger" type="button" onClick={() => setIsOpen((v) => !v)} aria-label="Meni">
          <span />
          <span />
          <span />
        </button>
        {isOpen ? (
          <div className="pulse-dropdown">
            <Link to="/" onClick={() => setIsOpen(false)}>Home</Link>
            <Link to="/settings" onClick={() => setIsOpen(false)}>Moj nalog</Link>
            {currentUser.role === 'admin' ? <Link to="/products" onClick={() => setIsOpen(false)}>Moji proizvodi</Link> : null}
            {currentUser.role === 'admin' ? <Link to="/templates" onClick={() => setIsOpen(false)}>Procesi</Link> : null}
            <button
              className="pulse-dropdown-button"
              type="button"
              onClick={() => {
                setIsOpen(false)
                onOpenGuide?.()
              }}
            >
              Kako koristiti PULSE
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}

export default AppTopBar
