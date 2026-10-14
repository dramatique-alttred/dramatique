import type { Metadata } from 'next'
import { seriesMetadata } from '@/lib/seriesMetadata'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return seriesMetadata(params.slug, 'series')
}

export default function SeriesLayout({ children }: { children: React.ReactNode }) {
  return children
}
