import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'
import { useBillingStore } from '../features/billing/billingStore'
import { useClientStore } from '../features/clients/clientStore'
import { useCloudStore } from '../features/cloud/cloudStore'
import { useProjectStore } from '../features/projects/projectStore'
import { useTaskStore } from '../features/tasks/taskStore'

type AppTopBarProps = {
  onOpenGuide?: () => void
}

type MenuItem = {
  to?: string
  label: string
  action?: () => void
}

function AppTopBar({ onOpenGuide }: AppTopBarProps) {
  const { currentUser } = useAuthStore()
  const cloud = useCloudStore()
  const clientStore = useClientStore()
  const projectStore = useProjectStore()
  const taskStore = useTaskStore()
  const billingStore = useBillingStore()
  const [isOpen, setIsOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
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

  const handleSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      await cloud.refreshWorkspace()
      await Promise.all([
        clientStore.refreshClientsFromCloud(),
        projectStore.refreshProjectsFromCloud(),
        taskStore.refreshTasksFromCloud(),
        billingStore.refreshBillingFromCloud(),
      ])
    } finally {
      setIsSyncing(false)
    }
  }

  const isAdmin = currentUser.role === 'admin'
  const isFinance = currentUser.role === 'finance'
  const userName = currentUser.name || currentUser.email || 'Korisnik'

  const menuItems: MenuItem[] = [
    { to: '/settings', label: 'Moj nalog' },
    ...(isAdmin ? [{ to: '/workspace', label: 'Moj Workspace' }] : []),
    ...(isAdmin ? [{ to: '/clients', label: 'Klijenti' }] : []),
    ...(isAdmin ? [{ to: '/projects', label: 'Projekti' }] : []),
    ...(isAdmin || isFinance ? [{ to: '/billing', label: 'Naplata' }] : []),
    ...(isAdmin ? [{ to: '/products', label: 'Proizvodi' }] : []),
    ...(isAdmin ? [{ to: '/templates', label: 'Procesi' }] : []),
    ...(isAdmin ? [{ to: '/data', label: 'Data' }] : []),
    { label: 'Kako koristiti Pulse', action: () => onOpenGuide?.() },
  ]

  const renderMenuItem = (item: MenuItem, isDropdown = false) => {
    if (item.to) {
      return (
        <Link key={item.label} to={item.to} onClick={isDropdown ? () => setIsOpen(false) : undefined}>
          {item.label}
        </Link>
      )
    }

    return (
      <button
        key={item.label}
        className="pulse-dropdown-button"
        type="button"
        onClick={() => {
          if (isDropdown) setIsOpen(false)
          item.action?.()
        }}
      >
        {item.label}
      </button>
    )
  }

  return (
    <header className="pulse-topbar">
      <Link to="/" className="pulse-logo-wrap" aria-label="PULSE home">
        <img src="/CRM/pulse-header-logo.png" alt="PULSE" className="pulse-logo" />
      </Link>
      <div className="pulse-user-block">
        <button className="pulse-sync-button" type="button" onClick={() => void handleSync()} disabled={isSyncing}>
          {isSyncing ? 'SYNC...' : 'SYNC'}
        </button>
        <strong>{userName}</strong>
      </div>
      <nav className="pulse-desktop-nav" aria-label="Glavni meni">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>
      <div className="pulse-menu" ref={menuRef}>
        <button className="pulse-hamburger" type="button" onClick={() => setIsOpen((v) => !v)} aria-label="Meni">
          <span />
          <span />
          <span />
        </button>
        {isOpen ? <div className="pulse-dropdown">{menuItems.map((item) => renderMenuItem(item, true))}</div> : null}
      </div>
    </header>
  )
}

export default AppTopBar
