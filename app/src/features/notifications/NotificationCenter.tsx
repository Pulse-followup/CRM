import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../auth/authStore'
import type { AppUser } from '../auth/types'
import {
  getBillingReadyItems,
  getInvoicedItems,
  getOverdueBillingItems,
  getPaidItems,
} from '../billing/billingSelectors'
import { useBillingStore } from '../billing/billingStore'
import type { BillingRecord } from '../billing/types'
import { useTaskStore } from '../tasks/taskStore'
import { getCompletedTasks, getTasksByUser } from '../tasks/taskSelectors'
import { getOverdueTasks } from '../tasks/taskSignals'
import type { Task } from '../tasks/types'
import { useNotificationStore } from './notificationStore'

function getNotificationLink(entityType: 'task' | 'billing', entityId: string) {
  if (entityType === 'task') return `/tasks/${entityId}`
  return '/billing'
}

type NotificationFeedItem = {
  id: string
  title: string
  body: string
  entityType: 'task' | 'billing'
  entityId: string
  createdAt: string
}

function sortByNewest(items: NotificationFeedItem[]) {
  return [...items].sort(
    (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  )
}

function formatAmount(amount?: number | null) {
  if (!amount) return ''
  return `${amount.toLocaleString('sr-RS')} RSD`
}

function buildAssignedTaskNotifications(tasks: Task[], currentUser: AppUser): NotificationFeedItem[] {
  return getTasksByUser(tasks, currentUser.id, currentUser.name)
    .filter((task) => task.status === 'dodeljen')
    .map((task) => ({
      id: `assigned-${task.id}`,
      title: 'Nova dodela taska',
      body: task.title || 'Imas novi aktivan task.',
      entityType: 'task',
      entityId: task.id,
      createdAt: task.updatedAt || task.createdAt,
    }))
}

function buildAdminStatusNotifications(tasks: Task[]): NotificationFeedItem[] {
  const lateIds = new Set(getOverdueTasks(tasks).map((task) => task.id))
  const takenItems = tasks
    .filter((task) => task.status === 'u_radu' && !lateIds.has(task.id))
    .map((task) => ({
      id: `taken-${task.id}`,
      title: 'Task je preuzet',
      body: task.assignedToLabel
        ? `${task.assignedToLabel} radi na tasku "${task.title || 'Task'}".`
        : task.title || 'Jedan task je preuzet.',
      entityType: 'task' as const,
      entityId: task.id,
      createdAt: task.updatedAt || task.createdAt,
    }))

  const lateItems = getOverdueTasks(tasks).map((task) => ({
    id: `late-${task.id}`,
    title: 'Task kasni',
    body: task.title || 'Jedan task je probio rok.',
    entityType: 'task' as const,
    entityId: task.id,
    createdAt: task.dueDate ? `${task.dueDate}T00:00:00` : task.updatedAt || task.createdAt,
  }))

  const completedItems = getCompletedTasks(tasks)
    .slice(0, 12)
    .map((task) => ({
      id: `completed-${task.id}`,
      title: 'Task je zavrsen',
      body: task.title || 'Jedan task je zavrsen.',
      entityType: 'task' as const,
      entityId: task.id,
      createdAt: task.completedAt || task.updatedAt || task.createdAt,
    }))

  return [...takenItems, ...lateItems, ...completedItems]
}

function buildFinanceNotifications(records: BillingRecord[]): NotificationFeedItem[] {
  const createItem = (
    prefix: string,
    title: string,
    bodyBuilder: (label: string, amount: string) => string,
    createdAtBuilder: (record: BillingRecord) => string,
    list: BillingRecord[],
  ) =>
    list.map((record) => {
      const label = record.projectName || record.clientName || record.description || 'Naplata'
      const amount = formatAmount(record.amount)

      return {
        id: `${prefix}-${record.id}`,
        title,
        body: bodyBuilder(label, amount),
        entityType: 'billing' as const,
        entityId: record.id,
        createdAt: createdAtBuilder(record),
      }
    })

  return [
    ...createItem(
      'billing-ready',
      'Nalog za fakturisanje',
      (label, amount) => amount ? `${label} je spreman za fakturisanje: ${amount}.` : `${label} je spreman za fakturisanje.`,
      (record) => record.updatedAt || record.createdAt,
      getBillingReadyItems(records),
    ),
    ...createItem(
      'billing-invoiced',
      'Fakturisano',
      (label, amount) => amount ? `${label} je fakturisan u iznosu ${amount}.` : `${label} je fakturisan.`,
      (record) => record.invoicedAt || record.updatedAt || record.createdAt,
      getInvoicedItems(records),
    ),
    ...createItem(
      'billing-overdue',
      'Kasni uplata',
      (label, amount) => amount ? `${label} kasni sa uplatom za ${amount}.` : `${label} kasni sa uplatom.`,
      (record) => record.dueDate ? `${record.dueDate}T00:00:00` : record.updatedAt || record.createdAt,
      getOverdueBillingItems(records),
    ),
    ...createItem(
      'billing-paid',
      'Placeno',
      (label, amount) => amount ? `${label} je placeno u iznosu ${amount}.` : `${label} je placeno.`,
      (record) => record.paidAt || record.updatedAt || record.createdAt,
      getPaidItems(records),
    ),
  ]
}

function buildDerivedNotificationFeed(tasks: Task[], billing: BillingRecord[], currentUser: AppUser) {
  if (currentUser.role === 'admin') {
    return sortByNewest(buildAdminStatusNotifications(tasks)).slice(0, 12)
  }

  if (currentUser.role === 'finance') {
    return sortByNewest(buildFinanceNotifications(billing)).slice(0, 12)
  }

  return sortByNewest(buildAssignedTaskNotifications(tasks, currentUser)).slice(0, 12)
}

function NotificationCenter() {
  const { enablePushNotifications, isNotificationSeen, markNotificationSeen } = useNotificationStore()
  const { currentUser } = useAuthStore()
  const { tasks } = useTaskStore()
  const { getAllBilling } = useBillingStore()
  const billing = getAllBilling()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const items = useMemo(() => buildDerivedNotificationFeed(tasks, billing, currentUser), [billing, currentUser, tasks])
  const unreadItems = useMemo(
    () => items.filter((item) => !isNotificationSeen(item.id)),
    [isNotificationSeen, items],
  )
  const unreadCount = unreadItems.length

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
        <span aria-hidden="true">{"\uD83D\uDD14"}</span>
        {unreadCount > 0 ? <span className="pulse-bell-counter">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
      </button>
      {isOpen ? (
        <div className="pulse-notification-dropdown">
          <div className="pulse-notification-head">
            <strong>Notifikacije</strong>
            <span>{unreadCount ? `${unreadCount} neprocitanih` : 'Sve procitano'}</span>
          </div>
          <div className="pulse-notification-list">
            {unreadItems.length ? unreadItems.map((item) => (
              <Link
                key={item.id}
                to={getNotificationLink(item.entityType, item.entityId)}
                className="pulse-notification-item is-unread"
                onClick={() => {
                  markNotificationSeen(item.id)
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

