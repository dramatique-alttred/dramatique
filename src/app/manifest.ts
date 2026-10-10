import type { MetadataRoute } from 'next'

/** Web app manifest — served at /manifest.webmanifest and linked automatically by Next */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Dramatique — Short Dramas',
    short_name: 'Dramatique',
    description: 'Stream the best micro-drama series. CEO Romance, Supernatural, Revenge, Crime Thriller.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#060609',
    theme_color: '#060609',
    categories: ['entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Shorts', url: '/shorts', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'My List', url: '/my-list', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Watch History', url: '/history', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
