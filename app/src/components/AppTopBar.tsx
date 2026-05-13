import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { gsap } from 'gsap'
import { useAuthStore } from '../features/auth/authStore'
import { useBillingStore } from '../features/billing/billingStore'
import { useClientStore } from '../features/clients/clientStore'
import { useCloudStore } from '../features/cloud/cloudStore'
import NotificationCenter from '../features/notifications/NotificationCenter'
import { useProjectStore } from '../features/projects/projectStore'
import { useTaskStore } from '../features/tasks/taskStore'
import { isUsageOwnerEmail } from '../features/usage/usageAccess'

type AppTopBarProps = {
  onOpenGuide?: () => void
}

type MenuItem = {
  to?: string
  label: string
  action?: () => void
  section?: 'primary' | 'secondary'
}

function AppTopBar({ onOpenGuide }: AppTopBarProps) {
  const { currentUser } = useAuthStore()
  const location = useLocation()
  const cloud = useCloudStore()
  const clientStore = useClientStore()
  const projectStore = useProjectStore()
  const taskStore = useTaskStore()
  const billingStore = useBillingStore()
  const [isOpen, setIsOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return undefined

    const ctx = gsap.context(() => {
      gsap.fromTo(
        dropdownRef.current,
        { autoAlpha: 0, x: 20, y: -8, scale: 0.98 },
        { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.22, ease: 'power2.out' },
      )
      gsap.fromTo(
        '.pulse-dropdown-section > *',
        { autoAlpha: 0, x: 10 },
        { autoAlpha: 1, x: 0, duration: 0.18, stagger: 0.035, ease: 'power2.out', delay: 0.04 },
      )
    }, dropdownRef)

    return () => ctx.revert()
  }, [isOpen])

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
  const canAccessUsage = isUsageOwnerEmail(currentUser.email)
  const userName = currentUser.name || currentUser.email || 'Korisnik'

  const menuItems: MenuItem[] = [
    ...(isAdmin ? [{ to: '/workspace', label: 'Moj Workspace', section: 'primary' as const }] : []),
    ...(isAdmin ? [{ to: '/clients', label: 'Klijenti', section: 'primary' as const }] : []),
    ...(isAdmin ? [{ to: '/projects', label: 'Projekti', section: 'primary' as const }] : []),
    ...(isAdmin || isFinance ? [{ to: '/billing', label: 'Naplata', section: 'primary' as const }] : []),
    ...(isAdmin ? [{ to: '/products', label: 'Proizvodi', section: 'primary' as const }] : []),
    ...(isAdmin ? [{ to: '/templates', label: 'Procesi', section: 'primary' as const }] : []),
    ...(isAdmin ? [{ to: '/data', label: 'Data', section: 'primary' as const }] : []),
    ...(canAccessUsage ? [{ to: '/admin/usage', label: 'Usage / Beta activity', section: 'primary' as const }] : []),
    { to: '/settings', label: 'Moj nalog', section: 'secondary' },
    { label: 'Uputstvo', action: () => onOpenGuide?.(), section: 'secondary' },
  ]

  const renderMenuItem = (item: MenuItem, isDropdown = false) => {
    const isActive = Boolean(item.to) && (location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
    const itemClassName = `${isDropdown ? 'pulse-dropdown-item' : 'pulse-desktop-nav-item'}${isActive ? ' is-active' : ''}`

    if (item.to) {
      return (
        <Link key={item.label} className={itemClassName} to={item.to} onClick={isDropdown ? () => setIsOpen(false) : undefined}>
          {item.label}
        </Link>
      )
    }

    return (
      <button
        key={item.label}
        className={`${isDropdown ? 'pulse-dropdown-item pulse-dropdown-button' : 'pulse-desktop-nav-item pulse-dropdown-button'}`}
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
        <NotificationCenter />
        <strong>{userName}</strong>
      </div>
      <nav className="pulse-desktop-nav" aria-label="Glavni meni">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>
      <div className="pulse-menu" ref={menuRef}>
        <button className={`pulse-hamburger${isOpen ? ' is-open' : ''}`} type="button" onClick={() => setIsOpen((v) => !v)} aria-label="Meni" aria-expanded={isOpen}>
          <span />
          <span />
          <span />
        </button>
        {isOpen ? (
          <>
            <button className="pulse-menu-backdrop" type="button" aria-label="Zatvori meni" onClick={() => setIsOpen(false)} />
            <div className="pulse-dropdown" ref={dropdownRef}>
              <div className="pulse-dropdown-section">
                {menuItems.filter((item) => item.section !== 'secondary').map((item) => renderMenuItem(item, true))}
              </div>
              <div className="pulse-dropdown-divider" />
              <div className="pulse-dropdown-section pulse-dropdown-section-secondary">
                {menuItems.filter((item) => item.section === 'secondary').map((item) => renderMenuItem(item, true))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </header>
  )
}

export default AppTopBar
