'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import BottomNav from '@/components/layout/BottomNav'
import { DailyRewardPrompt } from '@/components/monetisation/DailyReward'

/**
 * Renders the consumer-facing chrome (navbar, footer, mobile bottom nav)
 * on all pages EXCEPT the admin panel, which has its own self-contained layout.
 */
export default function ConsumerChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')

  if (isAdmin) {
    // Admin routes render bare — AdminLayout provides its own sidebar/topbar
    return <>{children}</>
  }

  return (
    <>
      <Navbar />
      {children}
      {/* The swipe feed is a full-screen surface — no footer under it */}
      {pathname !== '/shorts' && <Footer />}
      <BottomNav />
      <DailyRewardPrompt />
    </>
  )
}
