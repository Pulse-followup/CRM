import { getSupabaseClient } from '../../lib/supabaseClient'
import { getAppBasePath, getFirebasePushConfig, isFirebasePushConfigured } from './pushConfig'

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

type FirebaseMessagingCompat = {
  getToken: (options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }) => Promise<string>
  onMessage: (listener: (payload: FirebaseMessagePayload) => void) => void
}

type FirebaseNamespace = {
  apps?: unknown[]
  initializeApp: (config: Record<string, string>) => unknown
  messaging: () => FirebaseMessagingCompat
}

declare global {
  interface Window {
    firebase?: FirebaseNamespace
  }
}

const FIREBASE_APP_SCRIPT = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js'
const FIREBASE_MESSAGING_SCRIPT = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js'

let firebaseLoadPromise: Promise<FirebaseMessagingCompat> | null = null
let foregroundListenerBound = false
let latestForegroundCallback: (() => void) | null = null

function canUsePushMessaging() {
  if (typeof window === 'undefined') return false
  if (!window.isSecureContext && window.location.hostname !== 'localhost') return false
  return 'Notification' in window && 'serviceWorker' in navigator
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-pulse-src="${src}"]`) as HTMLScriptElement | null
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Script load failed: ${src}`)), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.pulseSrc = src
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    script.addEventListener('error', () => reject(new Error(`Script load failed: ${src}`)), { once: true })
    document.head.appendChild(script)
  })
}

async function getFirebaseMessaging() {
  if (!firebaseLoadPromise) {
    firebaseLoadPromise = (async () => {
      const config = getFirebasePushConfig()
      await loadScript(FIREBASE_APP_SCRIPT)
      await loadScript(FIREBASE_MESSAGING_SCRIPT)

      if (!window.firebase) {
        throw new Error('Firebase Messaging SDK nije ucitan.')
      }

      if (!window.firebase.apps?.length) {
        window.firebase.initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
          measurementId: config.measurementId,
        })
      }

      return window.firebase.messaging()
    })()
  }

  return firebaseLoadPromise
}

function buildServiceWorkerUrl() {
  const config = getFirebasePushConfig()
  const url = new URL(`${getAppBasePath()}firebase-messaging-sw.js`, window.location.origin)
  url.searchParams.set('apiKey', config.apiKey)
  url.searchParams.set('authDomain', config.authDomain)
  url.searchParams.set('projectId', config.projectId)
  url.searchParams.set('storageBucket', config.storageBucket)
  url.searchParams.set('messagingSenderId', config.messagingSenderId)
  url.searchParams.set('appId', config.appId)
  url.searchParams.set('measurementId', config.measurementId)
  url.searchParams.set('basePath', getAppBasePath())
  return url.toString()
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
    throw new Error(error.message || 'Device token nije sacuvan.')
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
    latestForegroundCallback = onForegroundMessage || null

    const registration = await navigator.serviceWorker.register(buildServiceWorkerUrl(), {
      scope: getAppBasePath(),
    })
    const messaging = await getFirebaseMessaging()

    if (!foregroundListenerBound) {
      messaging.onMessage(() => {
        latestForegroundCallback?.()
      })
      foregroundListenerBound = true
    }

    const token = await messaging.getToken({
      vapidKey: getFirebasePushConfig().vapidKey,
      serviceWorkerRegistration: registration,
    })

    if (!token) return 'error'

    await registerDeviceToken(workspaceId, userId, token)
    return 'ready'
  } catch (error) {
    console.error('Push registration failed', error)
    return 'error'
  }
}

export type { PushStatus }
