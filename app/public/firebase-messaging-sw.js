const firebaseConfig = {
  apiKey: 'AIzaSyDvSNsv5nWMXMOa4hW1ji0O0aPw4IgTf00',
  authDomain: 'pulse-7072b.firebaseapp.com',
  projectId: 'pulse-7072b',
  storageBucket: 'pulse-7072b.firebasestorage.app',
  messagingSenderId: '523914677345',
  appId: '1:523914677345:web:ceac7f2eca39751fc66e20',
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
