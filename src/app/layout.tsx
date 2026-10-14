import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import Providers from '@/components/Providers'
import ConsumerChrome from '@/components/layout/ConsumerChrome'
import PwaManager from '@/components/pwa/PwaManager'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dramatique-shorts.vercel.app'
const TITLE = 'Dramatique — Short Dramas. Big Emotions. Endless Stories.'
const DESCRIPTION = 'Stream the best micro-drama series. CEO Romance, Supernatural, Revenge, Crime Thriller.'

export const metadata: Metadata = {
  // Makes the share image and canonical links absolute for social crawlers
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Dramatique',
  // The share image comes from app/opengraph-image.png and app/twitter-image.png
  openGraph: { type: 'website', siteName: 'Dramatique', title: TITLE, description: DESCRIPTION, locale: 'en_US' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  // Installed on iOS: launches full-screen with a dark status bar
  appleWebApp: { capable: true, title: 'Dramatique', statusBarStyle: 'black' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#060609',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-brand-black text-brand-text antialiased">
        <Providers>
          <ToastProvider>
            <ConsumerChrome>{children}</ConsumerChrome>
            <PwaManager />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
