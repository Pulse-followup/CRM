import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { readStoredArray, writeStoredValue } from '../../shared/storage'
import { useAuthStore } from '../auth/authStore'
import { useCloudStore } from '../cloud/cloudStore'
import { getAppBaseUrl } from './pushConfig'
import { ensurePushRegistration, type PushStatus } from './pushService'
import type { AppNotification, CreateNotificationInput, NotificationToast } from './types'

const NOTIFICATIONS_STORAGE_KEY = 'pulse.notifications.v1'
const CLOUD_READ_STATE_STORAGE_KEY = 'pulse.notifications.seen.v1'

type CloudReadStatus = 'local' | 'loading' | 'cloud' | 'cloud-empty' | 'error'

interface NotificationStoreValue {
  notifications: AppNotification[]
  unreadCount: number
  toasts: NotificationToast[]
  cloudReadStatus: CloudReadStatus
  cloudReadError: string | null
  pushStatus: PushStatus
  lastPushResult: {
    sent: number
    skipped: number
    failed: number
    revokedTokens: number
    recordedAt: string
  } | null
  isNotificationSeen: (notificationId: string) => boolean
  markNotificationSeen: (notificationId: string) => void
  refreshNotificationsFromCloud: () => Promise<void>
  createNotification: (input: CreateNotificationInput) => Promise<AppNotification | null>
  createNotifications: (inputs: CreateNotificationInput[]) => Promise<AppNotification[]>
  markNotificationRead: (notificationId: string) => Promise<void>
  dismissToast: (toastId: string) => void
  pushToast: (title: string, body: string) => void
  enablePushNotifications: (allowPrompt?: boolean) => Promise<PushStatus>
}

const NotificationStoreContext = createContext<NotificationStoreValue | null>(null)

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function mapNotificationRowToReact(row: Record<string, unknown>): AppNotification {
  const createdAt = asString(row.created_at) || new Date().toISOString()
  return {
    id: asString(row.id),
    workspaceId: asString(row.workspace_id || row.workspaceId) || null,
    recipientUserId: asString(row.recipient_user_id || row.recipientUserId),
    type: asString(row.type) as AppNotification['type'],
    title: asString(row.title),
    body: asString(row.body),
    entityType: asString(row.entity_type || row.entityType) as AppNotification['entityType'],
    entityId: asString(row.entity_id || row.entityId),
    readAt: (row.read_at as string | null | undefined) ?? null,
    createdAt,
  }
}

function mapNotificationToSupabaseRow(notification: AppNotification, workspaceId: string) {
  return {
    id: notification.id,
    workspace_id: workspaceId,
    recipient_user_id: notification.recipientUserId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    entity_type: notification.entityType,
    entity_id: notification.entityId,
    read_at: notification.readAt || null,
    created_at: notification.createdAt,
  }
}

function mergeNotifications(records: AppNotification[]) {
  const map = new Map<string, AppNotification>()
  records.forEach((record) => {
    if (!record.id) return
    map.set(record.id, record)
  })
  return Array.from(map.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function readSeenNotificationIds() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CLOUD_READ_STATE_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeSeenNotificationIds(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CLOUD_READ_STATE_STORAGE_KEY, JSON.stringify(ids.slice(-300)))
  } catch {
    // best effort
  }
}

function upsertNotificationRecord(records: AppNotification[], nextRecord: AppNotification) {
  return mergeNotifications([nextRecord, ...records.filter((record) => record.id !== nextRecord.id)])
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { currentUser, isCloudUser } = useAuthStore()
  const { isConfigured, activeWorkspace } = useCloudStore()
  const isCloudNotificationMode = Boolean(isConfigured && activeWorkspace?.id && isCloudUser)
  const [localNotifications, setLocalNotifications] = useState<AppNotification[]>(() =>
    readStoredArray(NOTIFICATIONS_STORAGE_KEY, []),
  )
  const [cloudNotifications, setCloudNotifications] = useState<AppNotification[]>([])
  const [cloudReadStatus, setCloudReadStatus] = useState<CloudReadStatus>('local')
  const [cloudReadError, setCloudReadError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<NotificationToast[]>([])
  const [pushStatus, setPushStatus] = useState<PushStatus>('idle')
  const [lastPushResult, setLastPushResult] = useState<NotificationStoreValue['lastPushResult']>(null)
  const [seenVersion, setSeenVersion] = useState(0)
  const seenNotificationIdsRef = useRef<Set<string>>(new Set(readSeenNotificationIds()))

  const notifications = useMemo(
    () =>
      (isCloudNotificationMode ? cloudNotifications : localNotifications).filter(
        (notification) => notification.recipientUserId === currentUser.id,
      ),
    [cloudNotifications, currentUser.id, isCloudNotificationMode, localNotifications],
  )

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  )

  useEffect(() => {
    if (!isCloudNotificationMode) {
      writeStoredValue(NOTIFICATIONS_STORAGE_KEY, localNotifications)
    }
  }, [isCloudNotificationMode, localNotifications])

  const enqueueToasts = useCallback((records: AppNotification[]) => {
    const nextToasts = records
      .filter((record) => record.recipientUserId === currentUser.id && !record.readAt)
      .filter((record) => !seenNotificationIdsRef.current.has(record.id))
      .map((record) => ({
        id: makeId('toast'),
        notificationId: record.id,
        title: record.title,
        body: record.body,
      }))

    if (!nextToasts.length) return

    nextToasts.forEach((toast) => seenNotificationIdsRef.current.add(toast.notificationId))
    writeSeenNotificationIds(Array.from(seenNotificationIdsRef.current))
    setToasts((current) => [...current, ...nextToasts].slice(-4))
  }, [currentUser.id])

  const isNotificationSeen = useCallback((notificationId: string) => {
    return seenNotificationIdsRef.current.has(notificationId)
  }, [seenVersion])

  const markNotificationSeen = useCallback((notificationId: string) => {
    if (!notificationId || seenNotificationIdsRef.current.has(notificationId)) return
    seenNotificationIdsRef.current.add(notificationId)
    writeSeenNotificationIds(Array.from(seenNotificationIdsRef.current))
    setToasts((current) => current.filter((toast) => toast.notificationId !== notificationId))
    setSeenVersion((current) => current + 1)
  }, [])

  const refreshNotificationsFromCloud = useCallback(async () => {
    if (!isConfigured || !activeWorkspace?.id || !isCloudUser) {
      setCloudReadStatus('local')
      setCloudReadError(null)
      return
    }

    const supabase = getSupabaseClient()
    if (!supabase || !currentUser.id) {
      setCloudReadStatus('cloud-empty')
      setCloudReadError(null)
      return
    }

    setCloudReadStatus('loading')
    setCloudReadError(null)

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .eq('recipient_user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      setCloudReadStatus('error')
      setCloudReadError(error.message || 'Notifikacije nisu učitane.')
      return
    }

    const nextNotifications = Array.isArray(data)
      ? data.map((row) => mapNotificationRowToReact(row as Record<string, unknown>))
      : []

    setCloudNotifications(nextNotifications)
    setCloudReadStatus(nextNotifications.length ? 'cloud' : 'cloud-empty')
    enqueueToasts(nextNotifications)
  }, [activeWorkspace?.id, currentUser.id, enqueueToasts, isCloudUser, isConfigured])

  const enablePushNotifications = useCallback(async (allowPrompt = false) => {
    if (!activeWorkspace?.id || !currentUser.id || !isCloudNotificationMode) {
      setPushStatus('disabled')
      return 'disabled'
    }

    const nextStatus = await ensurePushRegistration({
      workspaceId: activeWorkspace.id,
      userId: currentUser.id,
      allowPrompt,
      onForegroundMessage: () => undefined,
    })
    setPushStatus(nextStatus)
    return nextStatus
  }, [activeWorkspace?.id, currentUser.id, isCloudNotificationMode, refreshNotificationsFromCloud])

  useEffect(() => {
    if (!isCloudNotificationMode || typeof window === 'undefined') {
      setPushStatus('disabled')
      return
    }
 
    setPushStatus('idle')
  }, [isCloudNotificationMode])

  useEffect(() => {
    if (!isCloudNotificationMode) return
    if (!activeWorkspace?.id || !currentUser.id) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    let isCancelled = false

    void ensurePushRegistration({
      workspaceId: activeWorkspace.id,
      userId: currentUser.id,
      allowPrompt: false,
      onForegroundMessage: () => undefined,
    }).then((status) => {
      if (!isCancelled) setPushStatus(status)
    })

    return () => {
      isCancelled = true
    }
  }, [activeWorkspace?.id, currentUser.id, isCloudNotificationMode])

  useEffect(() => {
    if (!isCloudNotificationMode) return

    void refreshNotificationsFromCloud()

    const intervalId = window.setInterval(() => {
      void refreshNotificationsFromCloud()
    }, 5000)

    const handleFocus = () => {
      void refreshNotificationsFromCloud()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isCloudNotificationMode, refreshNotificationsFromCloud])

  useEffect(() => {
    if (!isCloudNotificationMode || !activeWorkspace?.id || !currentUser.id) return

    const supabase = getSupabaseClient()
    if (!supabase) return

    const channel = supabase.channel(`notifications:${activeWorkspace.id}:${currentUser.id}`)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `workspace_id=eq.${activeWorkspace.id}`,
      },
      (payload) => {
        const sourceRow =
          payload.eventType === 'DELETE'
            ? (payload.old as Record<string, unknown> | null)
            : (payload.new as Record<string, unknown> | null)
        if (!sourceRow) return

        const nextNotification = mapNotificationRowToReact(sourceRow)
        if (nextNotification.recipientUserId !== currentUser.id) return

        if (payload.eventType === 'DELETE') {
          setCloudNotifications((current) =>
            current.filter((notification) => notification.id !== nextNotification.id),
          )
          return
        }

        setCloudNotifications((current) => upsertNotificationRecord(current, nextNotification))
        if (payload.eventType === 'INSERT') {
          enqueueToasts([nextNotification])
        }
      },
    )

    void channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [
    activeWorkspace?.id,
    currentUser.id,
    enqueueToasts,
    isCloudNotificationMode,
  ])

  const createNotifications = useCallback(async (inputs: CreateNotificationInput[]) => {
    const deduped = inputs.filter((input, index, array) =>
      Boolean(input.recipientUserId) &&
      array.findIndex((candidate) =>
        candidate.recipientUserId === input.recipientUserId &&
        candidate.type === input.type &&
        candidate.entityType === input.entityType &&
        candidate.entityId === input.entityId,
      ) === index,
    )

    if (!deduped.length) return []

    const now = new Date().toISOString()
    const records: AppNotification[] = deduped.map((input) => ({
      id: makeId('notification'),
      workspaceId: activeWorkspace?.id || null,
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
      readAt: null,
      createdAt: now,
    }))

    if (isCloudNotificationMode) {
      const supabase = getSupabaseClient()
      if (!supabase || !activeWorkspace?.id) return []

      const { error } = await supabase
        .from('notifications')
        .insert(records.map((record) => mapNotificationToSupabaseRow(record, activeWorkspace.id!)))

      if (error) {
        setCloudReadStatus('error')
        setCloudReadError(error.message)
        return []
      }

      const savedRecords = records
      setCloudNotifications((current) => mergeNotifications([...savedRecords, ...current]))
      enqueueToasts(savedRecords)
      if (savedRecords.length) {
        void supabase.functions
          .invoke('send-notification-push', {
            body: {
              workspaceId: activeWorkspace.id,
              notificationIds: savedRecords.map((record) => record.id),
              appBaseUrl: getAppBaseUrl(),
            },
          })
          .then(({ data, error }) => {
            if (error) {
              console.error('[PULSE push] send-notification-push invoke failed', error)
              setLastPushResult({
                sent: 0,
                skipped: 0,
                failed: savedRecords.length,
                revokedTokens: 0,
                recordedAt: new Date().toISOString(),
              })
              return
            }

            const payload = (data || {}) as Partial<{
              sent: number
              skipped: number
              failed: number
              revokedTokens: number
            }>
            setLastPushResult({
              sent: Number(payload.sent || 0),
              skipped: Number(payload.skipped || 0),
              failed: Number(payload.failed || 0),
              revokedTokens: Number(payload.revokedTokens || 0),
              recordedAt: new Date().toISOString(),
            })
          })
      }
      return savedRecords
    }

    setLocalNotifications((current) => mergeNotifications([...records, ...current]))
    enqueueToasts(records)
    return records
  }, [activeWorkspace?.id, enqueueToasts, isCloudNotificationMode])

  const createNotification = useCallback(
    async (input: CreateNotificationInput) => {
      const created = await createNotifications([input])
      return created[0] ?? null
    },
    [createNotifications],
  )

  const markNotificationRead = useCallback(async (notificationId: string) => {
    const readAt = new Date().toISOString()

    if (isCloudNotificationMode) {
      const supabase = getSupabaseClient()
      if (supabase) {
        const { error } = await supabase
          .from('notifications')
          .update({ read_at: readAt })
          .eq('id', notificationId)
          .eq('recipient_user_id', currentUser.id)
        if (error) {
          setCloudReadStatus('error')
          setCloudReadError(error.message)
          return
        }
      }
      setCloudNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, readAt } : item)),
      )
    } else {
      setLocalNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, readAt } : item)),
      )
    }
  }, [currentUser.id, isCloudNotificationMode])

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  }, [])

  const pushToast = useCallback((title: string, body: string) => {
    setToasts((current) => [...current, {
      id: makeId('toast'),
      notificationId: makeId('toast-message'),
      title,
      body,
    }].slice(-4))
  }, [])

  const value = useMemo<NotificationStoreValue>(
    () => ({
      notifications,
      unreadCount,
      toasts,
      cloudReadStatus,
      cloudReadError,
      pushStatus,
      lastPushResult,
      isNotificationSeen,
      markNotificationSeen,
      refreshNotificationsFromCloud,
      createNotification,
      createNotifications,
      markNotificationRead,
      dismissToast,
      pushToast,
      enablePushNotifications,
    }),
    [
      cloudReadError,
      cloudReadStatus,
      createNotification,
      createNotifications,
      dismissToast,
      enablePushNotifications,
      isNotificationSeen,
      markNotificationSeen,
      markNotificationRead,
      lastPushResult,
      notifications,
      pushToast,
      pushStatus,
      refreshNotificationsFromCloud,
      toasts,
      unreadCount,
    ],
  )

  return <NotificationStoreContext.Provider value={value}>{children}</NotificationStoreContext.Provider>
}

export function useNotificationStore() {
  const context = useContext(NotificationStoreContext)
  if (!context) throw new Error('useNotificationStore must be used within NotificationProvider')
  return context
}
