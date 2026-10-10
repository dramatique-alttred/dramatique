import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import Providers from '@/components/Providers'
import ConsumerChrome from '@/components/layout/ConsumerChrome'
import PwaManager from '@/components/pwa/PwaManager'

export const metadata: Metadata = {
  title: 'Dramatique — Short Dramas. Big Emotions. Endless Stories.',
  description: 'Stream the best micro-drama series. CEO Romance, Supernatural, Revenge, Crime Thriller.',
  applicationName: 'Dramatique',
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
