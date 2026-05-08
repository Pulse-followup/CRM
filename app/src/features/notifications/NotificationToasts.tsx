import { useEffect } from 'react'
import { useNotificationStore } from './notificationStore'

function NotificationToasts() {
  const { toasts, dismissToast } = useNotificationStore()

  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), 4500),
    )
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [dismissToast, toasts])

  if (!toasts.length) return null

  return (
    <div className="pulse-toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <article key={toast.id} className="pulse-toast-card">
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.body}</p>
          </div>
          <button type="button" className="pulse-toast-close" onClick={() => dismissToast(toast.id)} aria-label="Zatvori notifikaciju">
            ×
          </button>
        </article>
      ))}
    </div>
  )
}

export default NotificationToasts
