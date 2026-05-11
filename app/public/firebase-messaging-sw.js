const firebaseConfig = {
  apiKey: 'AIzaSyDgrHff-VQmRQv7CrpwHejz1l_ENSNX-NY',
  authDomain: 'pulse-crm-2f9ce.firebaseapp.com',
  projectId: 'pulse-crm-2f9ce',
  storageBucket: 'pulse-crm-2f9ce.firebasestorage.app',
  messagingSenderId: '663758120986',
  appId: '1:663758120986:web:0c9037c17aa427bef389a3',
  measurementId: 'G-Q2TMG7P5DF',
}
const basePath = '/CRM/'

function canInitFirebase() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId,
  )
}

function buildAssetUrl(fileName) {
  const origin = self.location.origin || ''
  const cleanBase = basePath.endsWith('/') ? basePath : `${basePath}/`
  return `${origin}${cleanBase}${fileName}`.replace(/([^:]\/)\/+/g, '$1')
}

function buildNotificationLink(payload) {
  const payloadLink = payload?.data?.link || payload?.fcmOptions?.link || ''
  if (payloadLink) return payloadLink
  return `${self.location.origin}${basePath}`
}

if (canInitFirebase()) {
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js')
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js')

  self.firebase.initializeApp(firebaseConfig)

  const messaging = self.firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || 'PULSE obavestenje'
    const body = payload?.notification?.body || ''
    const link = buildNotificationLink(payload)

    self.registration.showNotification(title, {
      body,
      icon: buildAssetUrl('icon-192.png'),
      badge: buildAssetUrl('icon-192.png'),
      data: {
        link,
      },
    })
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification?.data?.link || `${self.location.origin}${basePath}`

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(link)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(link)
      }
      return undefined
    }),
  )
})
