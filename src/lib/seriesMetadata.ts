import type { Metadata } from 'next'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

interface SeriesLite {
  title: string
  synopsis: string
  thumbnail_url: string
  hero_url?: string
  genre?: string
  total_episodes?: number
}

/**
 * Link-preview metadata for a series. Server-side, so WhatsApp / Instagram /
 * X / Facebook crawlers (which don't run JavaScript) see the real title,
 * description and artwork when someone shares a drama.
 */
export async function seriesMetadata(slug: string, path: 'watch' | 'series'): Promise<Metadata> {
  try {
    const res = await fetch(`${API}/catalog/series/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } })
    if (!res.ok) return {}
    const body = await res.json()
    const s: SeriesLite = body?.data ?? body
    if (!s?.title) return {}

    const title = `${s.title} — Watch free on Dramatique`
    const description = (s.synopsis || '').replace(/\s+/g, ' ').trim().slice(0, 200)
      || `Watch ${s.title} on Dramatique. Short dramas. Big emotions. Endless stories.`
    const image = s.hero_url || s.thumbnail_url
    const images = image ? [{ url: image, alt: s.title }] : undefined

    return {
      title,
      description,
      alternates: { canonical: `/${path}/${slug}` },
      openGraph: { type: 'video.tv_show', siteName: 'Dramatique', title, description, images, url: `/${path}/${slug}` },
      twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
    }
  } catch {
    return {}
  }
}
