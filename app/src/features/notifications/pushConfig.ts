type FirebasePushRuntimeConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId: string
  vapidKey: string
}

declare global {
  interface Window {
    PULSE_FIREBASE_CONFIG?: Partial<FirebasePushRuntimeConfig>
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getFirebasePushConfig(): FirebasePushRuntimeConfig {
  return {
    apiKey: asString(import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: asString(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: asString(import.meta.env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: asString(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: asString(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: asString(import.meta.env.VITE_FIREBASE_APP_ID),
    measurementId: asString(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
    vapidKey: asString(import.meta.env.VITE_FIREBASE_VAPID_KEY),
  }
}

export function isFirebasePushConfigured() {
  const config = getFirebasePushConfig()

  return Boolean(
    config.apiKey &&
      config.projectId &&
      config.messagingSenderId &&
      config.appId &&
      config.vapidKey,
  )
}

export function getAppBasePath() {
  return import.meta.env.BASE_URL || '/'
}

export function getAppBaseUrl() {
  if (typeof window === 'undefined') return ''
  return new URL(getAppBasePath(), window.location.origin).toString()
}

let hasLoggedFirebaseEnv = false

export function logFirebasePushEnv() {
  if (!import.meta.env.DEV || hasLoggedFirebaseEnv) return

  const { apiKey, projectId, messagingSenderId, appId, vapidKey } = getFirebasePushConfig()
  hasLoggedFirebaseEnv = true

  console.log('[PULSE push] Firebase env loaded', {
    projectId,
    senderId: messagingSenderId,
    hasApiKey: Boolean(apiKey),
    hasAppId: Boolean(appId),
    hasVapidKey: Boolean(vapidKey),
  })
}
