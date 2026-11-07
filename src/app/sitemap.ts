import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dramatique.net').replace(/\/$/, '')
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

const STATIC_PAGES: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '', priority: 1, changeFrequency: 'daily' },
  { path: '/shorts', priority: 0.8, changeFrequency: 'daily' },
  { path: '/new-hot', priority: 0.8, changeFrequency: 'daily' },
  { path: '/categories', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/vip', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/download', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/help', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'monthly' },
  { path: '/refund', priority: 0.2, changeFrequency: 'monthly' },
]

// Rebuilt at most hourly, so a newly published drama shows up without a deploy
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const pages: MetadataRoute.Sitemap = STATIC_PAGES.map(p => ({
    url: `${SITE_URL}${p.path}`, lastModified: now, changeFrequency: p.changeFrequency, priority: p.priority,
  }))

  try {
    const res = await fetch(`${API}/catalog/series`, { next: { revalidate: 3600 } })
    if (!res.ok) return pages
    const body = await res.json()
    const list: { slug?: string }[] = Array.isArray(body) ? body : body?.data ?? []
    for (const s of list) {
      if (!s?.slug) continue
      const slug = encodeURIComponent(s.slug)
      pages.push({ url: `${SITE_URL}/series/${slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 })
      pages.push({ url: `${SITE_URL}/watch/${slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 })
    }
  } catch { /* API unreachable: still serve the static pages */ }

  return pages
}
