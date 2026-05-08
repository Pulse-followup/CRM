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
  const runtimeConfig = typeof window !== 'undefined' ? window.PULSE_FIREBASE_CONFIG : undefined

  return {
    apiKey: asString(import.meta.env.VITE_FIREBASE_API_KEY || runtimeConfig?.apiKey),
    authDomain: asString(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || runtimeConfig?.authDomain),
    projectId: asString(import.meta.env.VITE_FIREBASE_PROJECT_ID || runtimeConfig?.projectId),
    storageBucket: asString(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || runtimeConfig?.storageBucket),
    messagingSenderId: asString(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || runtimeConfig?.messagingSenderId),
    appId: asString(import.meta.env.VITE_FIREBASE_APP_ID || runtimeConfig?.appId),
    measurementId: asString(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || runtimeConfig?.measurementId),
    vapidKey: asString(import.meta.env.VITE_FIREBASE_VAPID_KEY || runtimeConfig?.vapidKey),
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
