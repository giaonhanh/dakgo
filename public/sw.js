const CACHE_NAME = 'dakgo-v5'
const MAP_CACHE  = 'dakgo-maps-v2'
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/driver',
  '/driver/orders',
  '/driver/earnings',
  '/driver/profile',
]

// ── Install: precache critical URLs ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: xóa cache cũ + báo client reload ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== MAP_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((clients) => clients.forEach((c) => c.postMessage({ type: 'SW_UPDATED' })))
  )
})

// ── Fetch ──
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Chỉ xử lý GET
  if (request.method !== 'GET') return

  // API calls: network only, không cache (dữ liệu realtime)
  if (url.pathname.startsWith('/api/')) return

  // Bản đồ VietMap (tiles vector + style + sprite + glyphs): KHÔNG cho SW chen vào.
  // MapLibre fetch tile/glyph trong Web Worker cross-origin — nếu SW bọc lại bằng
  // fetch(request) sẽ làm hỏng response → tile 200 nhưng map trắng. Bỏ qua hẳn.
  if (url.hostname.includes('vietmap.vn')) return

  // Map tiles (CartoDB / OSM): cache-first 24h
  if (url.hostname.includes('cartocdn.com') || url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(MAP_CACHE).then((c) => c.put(request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // _next/static: immutable assets, cache-first mãi mãi
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Navigation (page loads): network-first, fallback offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && (url.pathname === '/' || url.pathname === '/offline')) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  // Mặc định: network-first, fallback cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// ── Push Notifications ──
self.addEventListener('push', (event) => {
  const data  = event.data?.json() ?? {}
  const sound = data.data?.sound ?? null

  event.waitUntil(
    Promise.all([
      // 1. Hiện notification
      self.registration.showNotification(data.title ?? 'DakGo', {
        body:     data.body ?? '',
        icon:     '/icon-192.png',
        badge:    '/icon-192.png',
        data:     data.data ?? {},
        vibrate:  [300, 100, 300, 100, 300],
        tag:      data.tag ?? 'default',
        renotify: true,
      }),
      // 2. Báo tab đang mở phát âm thanh
      sound
        ? self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            clients.forEach(c => c.postMessage({ type: 'PLAY_ORDER_SOUND', sound }))
          })
        : Promise.resolve(),
    ])
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((w) => w.url.includes(targetUrl) && 'focus' in w)
      if (existing) return existing.focus()
      return clients.openWindow(targetUrl)
    })
  )
})
