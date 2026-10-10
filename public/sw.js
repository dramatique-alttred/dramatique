/*
 * Dramatique service worker — makes the site installable and keeps it usable on flaky mobile data.
 *
 * Only same-origin GETs are handled. API calls (separate backend origin), Firebase and
 * video (HLS on the media Worker) are never touched, so auth, coins and signed URLs stay live.
 *
 *  - Pages:            network first → cached copy → /offline (precached with its assets)
 *  - /_next/static:    cache first (file names are content-hashed, so they never go stale)
 *  - Images & icons:   stale-while-revalidate
 *
 * Bump VERSION to drop every old cache on the next deploy.
 */
const VERSION = 'v1'
const SHELL = `shell-${VERSION}`
const PAGES = `pages-${VERSION}`
const STATIC = `static-${VERSION}`
const IMAGES = `images-${VERSION}`
const OFFLINE_URL = '/offline'

const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png']
const LIMITS = { [PAGES]: 40, [STATIC]: 300, [IMAGES]: 150 }

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL)
    await shell.addAll(PRECACHE)
    // The offline page must hydrate with no network, so cache the scripts/styles it references too.
    // Kept in its own cache so trimming never evicts them.
    const html = await (await shell.match(OFFLINE_URL)).text()
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])]
    await shell.addAll(assets)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, PAGES, STATIC, IMAGES])
    for (const key of await caches.keys()) {
      if (!keep.has(key)) await caches.delete(key)
    }
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('range')) return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // The admin panel is always live
  if (url.pathname.startsWith('/admin')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(event))
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC))
  } else if (
    request.destination === 'image' ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(staleWhileRevalidate(event, IMAGES))
  }
})

async function networkFirstPage(event) {
  const { request } = event
  const cache = await caches.open(PAGES)
  try {
    const response = (await event.preloadResponse) || (await fetch(request))
    if (response.ok && response.type === 'basic') {
      event.waitUntil(cache.put(request, response.clone()).then(() => trim(PAGES)))
    }
    return response
  } catch {
    return (await cache.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error()
  }
}

async function cacheFirst(request, name) {
  const hit = await caches.match(request)
  if (hit) return hit
  const cache = await caches.open(name)
  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
    trim(name)
  }
  return response
}

async function staleWhileRevalidate(event, name) {
  const { request } = event
  const cache = await caches.open(name)
  const hit = await caches.match(request)
  const refresh = fetch(request)
    .then(async response => {
      if (response.ok) {
        await cache.put(request, response.clone())
        await trim(name)
      }
      return response
    })
    .catch(() => undefined)
  if (hit) {
    event.waitUntil(refresh)
    return hit
  }
  return (await refresh) || Response.error()
}

/** Keeps each cache bounded — oldest entries go first */
async function trim(name) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  const extra = keys.length - (LIMITS[name] || 100)
  for (let i = 0; i < extra; i++) await cache.delete(keys[i])
}
