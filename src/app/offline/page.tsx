import { WifiOff } from '@/components/ui/icons'

export const metadata = { title: 'Offline — Dramatique' }

/**
 * Served by the service worker when a page is requested with no connection and no cached copy.
 * Works without JavaScript: its scripts may not be cached when it's shown.
 */
export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-brand-black flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-brand-card border border-brand-border flex items-center justify-center mx-auto mb-6">
          <WifiOff size={28} className="text-brand-red" />
        </div>
        <h1 className="text-white font-bold text-2xl mb-2">You're offline</h1>
        <p className="text-brand-subtle text-sm mb-8 leading-relaxed">
          Check your mobile data or Wi-Fi, then try again. Your coins and progress are safe.
        </p>
        {/* Empty href reloads whatever URL the visitor was trying to open */}
        <a href="" className="btn-primary py-3 px-8 inline-block">Try again</a>
      </div>
    </main>
  )
}
