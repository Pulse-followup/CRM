import { getSupabaseClient } from '../../lib/supabaseClient'
import { getAppBasePath, getFirebasePushConfig, isFirebasePushConfigured, logFirebasePushEnv } from './pushConfig'

type PushStatus = 'idle' | 'unsupported' | 'disabled' | 'denied' | 'error' | 'ready'

type EnsurePushRegistrationOptions = {
  workspaceId: string
  userId: string
  allowPrompt?: boolean
  onForegroundMessage?: () => void
}

type FirebaseMessagePayload = {
  data?: Record<string, string>
  notification?: {
    title?: string
    body?: string
  }
}

type FirebaseApp = unknown

type FirebaseMessaging = {
  __brand?: 'FirebaseMessaging'
}

type FirebaseAppModule = {
  getApps: () => FirebaseApp[]
  initializeApp: (config: Record<string, string>) => FirebaseApp
}

type FirebaseMessagingModule = {
  getMessaging: (app?: FirebaseApp) => FirebaseMessaging
  getToken: (
    messaging: FirebaseMessaging,
    options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration },
  ) => Promise<string>
  isSupported: () => Promise<boolean>
  onMessage: (messaging: FirebaseMessaging, listener: (payload: FirebaseMessagePayload) => void) => void
}

const FIREBASE_APP_MODULE_URL = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'
const FIREBASE_MESSAGING_MODULE_URL = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js'

let firebaseLoadPromise: Promise<{
  messaging: FirebaseMessaging
  getToken: FirebaseMessagingModule['getToken']
  onMessage: FirebaseMessagingModule['onMessage']
}> | null = null
let foregroundListenerBound = false
let latestForegroundCallback: (() => void) | null = null

function canUsePushMessaging() {
  if (typeof window === 'undefined') return false
  if (!window.isSecureContext && window.location.hostname !== 'localhost') return false
  return 'Notification' in window && 'serviceWorker' in navigator
}

async function loadFirebaseModules() {
  const [appModule, messagingModule] = await Promise.all([
    import(/* @vite-ignore */ FIREBASE_APP_MODULE_URL) as Promise<FirebaseAppModule>,
    import(/* @vite-ignore */ FIREBASE_MESSAGING_MODULE_URL) as Promise<FirebaseMessagingModule>,
  ])

  return { appModule, messagingModule }
}

async function getFirebaseMessaging() {
  if (!firebaseLoadPromise) {
    firebaseLoadPromise = (async () => {
      const config = getFirebasePushConfig()
      const { appModule, messagingModule } = await loadFirebaseModules()
      const isSupported = await messagingModule.isSupported()

      if (!isSupported) {
        throw new Error('Firebase Messaging nije podrzan u ovom browser okruzenju.')
      }

      const app = appModule.getApps()[0] || appModule.initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
        measurementId: config.measurementId,
      })

      return {
        messaging: messagingModule.getMessaging(app),
        getToken: messagingModule.getToken,
        onMessage: messagingModule.onMessage,
      }
    })()
  }

  return firebaseLoadPromise
}

function buildServiceWorkerUrl() {
  return new URL(`${getAppBasePath()}firebase-messaging-sw.js`, window.location.origin).toString()
}

async function cleanupLegacyServiceWorkers(nextServiceWorkerUrl: string) {
  const registrations = await navigator.serviceWorker.getRegistrations()

  await Promise.all(
    registrations.map(async (registration) => {
      const activeScriptUrl =
        registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || ''

      if (!activeScriptUrl.includes('firebase-messaging-sw.js')) return
      if (activeScriptUrl === nextServiceWorkerUrl) return

      await registration.unregister()
    }),
  )
}

function getDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Web device'
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    'Web'
  return `${platform} web`
}

async function registerDeviceToken(workspaceId: string, userId: string, token: string) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const timestamp = new Date().toISOString()
  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      {
        workspace_id: workspaceId,
        recipient_user_id: userId,
        token,
        platform: 'web',
        device_label: getDeviceLabel(),
        last_seen_at: timestamp,
        updated_at: timestamp,
        revoked_at: null,
      },
      { onConflict: 'workspace_id,recipient_user_id,token' },
    )

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[PULSE push] device token save failed', error)
    }
    throw new Error(error.message || 'Device token nije sacuvan.')
  }

  if (import.meta.env.DEV) {
    console.log('[PULSE push] device token saved')
  }
}

export async function ensurePushRegistration({
  workspaceId,
  userId,
  allowPrompt = false,
  onForegroundMessage,
}: EnsurePushRegistrationOptions): Promise<PushStatus> {
  if (!canUsePushMessaging()) return 'unsupported'
  if (!isFirebasePushConfigured()) return 'disabled'

  const currentPermission = Notification.permission
  if (currentPermission === 'denied') return 'denied'
  if (currentPermission === 'default' && !allowPrompt) return 'idle'

  let permission: NotificationPermission = currentPermission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'idle'

  try {
    logFirebasePushEnv()
    latestForegroundCallback = onForegroundMessage || null
    const serviceWorkerUrl = buildServiceWorkerUrl()

    await cleanupLegacyServiceWorkers(serviceWorkerUrl)

    const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: getAppBasePath(),
      updateViaCache: 'none',
    })
    await registration.update()
    const messaging = await getFirebaseMessaging()

    if (!foregroundListenerBound) {
      messaging.onMessage(messaging.messaging, () => {
        latestForegroundCallback?.()
      })
      foregroundListenerBound = true
    }

    const token = await messaging.getToken(messaging.messaging, {
      vapidKey: getFirebasePushConfig().vapidKey,
      serviceWorkerRegistration: registration,
    })

    if (import.meta.env.DEV) {
      console.log('[PULSE push] token acquired', {
        hasToken: Boolean(token),
        tokenPreview: token ? `${token.slice(0, 12)}...` : '',
      })
    }

    if (!token) return 'error'

    await registerDeviceToken(workspaceId, userId, token)
    return 'ready'
  } catch (error) {
    if (import.meta.env.DEV) {
      const firebaseError = error as {
        code?: string
        message?: string
        customData?: unknown
        stack?: string
      }

      console.error('[PULSE push] registration diagnostics', {
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
        serviceWorkerUrl: buildServiceWorkerUrl(),
        errorCode: firebaseError?.code || '',
        errorMessage: firebaseError?.message || String(error),
        customData: firebaseError?.customData || null,
      })
    }
    console.error('Push registration failed', error)
    return 'error'
  }
}

export type { PushStatus }
