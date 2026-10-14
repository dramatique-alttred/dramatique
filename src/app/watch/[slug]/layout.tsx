import type { Metadata } from 'next'
import { seriesMetadata } from '@/lib/seriesMetadata'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return seriesMetadata(params.slug, 'watch')
}

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return children
}
