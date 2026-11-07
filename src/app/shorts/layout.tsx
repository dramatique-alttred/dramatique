import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shorts',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
