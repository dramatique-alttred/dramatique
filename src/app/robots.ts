import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dramatique.net').replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private, per-account and back-office pages have nothing to index
      disallow: ['/admin', '/auth', '/profile', '/settings', '/my-list', '/history', '/transactions', '/coins', '/invite', '/payment', '/join', '/offline'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
