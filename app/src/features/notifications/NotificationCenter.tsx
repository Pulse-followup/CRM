import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotificationStore } from './notificationStore'

function getNotificationLink(entityType: 'task' | 'billing', entityId: string) {
  if (entityType === 'task') return `/tasks/${entityId}`
  return '/billing'
}

function NotificationCenter() {
  const { notifications, unreadCount, markNotificationRead, enablePushNotifications } = useNotificationStore()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const items = useMemo(() => notifications.slice(0, 12), [notifications])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="pulse-notifications" ref={rootRef}>
      <button
        type="button"
        className={`pulse-bell-button${isOpen ? ' is-open' : ''}`}
        onClick={() => {
          void enablePushNotifications(true)
          setIsOpen((current) => !current)
        }}
        aria-label="Notifikacije"
        aria-expanded={isOpen}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 ? <span className="pulse-bell-counter">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
      </button>
      {isOpen ? (
        <div className="pulse-notification-dropdown">
          <div className="pulse-notification-head">
            <strong>Notifikacije</strong>
            <span>{unreadCount ? `${unreadCount} neprocitanih` : 'Sve procitano'}</span>
          </div>
          <div className="pulse-notification-list">
            {items.length ? items.map((item) => (
              <Link
                key={item.id}
                to={getNotificationLink(item.entityType, item.entityId)}
                className={`pulse-notification-item${item.readAt ? '' : ' is-unread'}`}
                onClick={() => {
                  void markNotificationRead(item.id)
                  setIsOpen(false)
                }}
              >
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </Link>
            )) : <div className="pulse-notification-empty">Nema notifikacija.</div>}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default NotificationCenter
