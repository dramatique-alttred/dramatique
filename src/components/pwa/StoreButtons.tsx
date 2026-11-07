'use client'

import { AppleLogo } from '@/components/ui/icons'
import { usePwaStore } from '@/store/pwaStore'
import { track } from '@/lib/analytics'

// Google Play's four-colour mark
function GooglePlayMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#00A0FF" d="M3.6 2.3 13.4 12l-9.8 9.7c-.2-.2-.3-.5-.3-.9V3.2c0-.4.1-.7.3-.9z" />
      <path fill="#00E475" d="M3.6 2.3c.3-.2.7-.2 1.2.1l11.8 6.4-3.2 3.2z" />
      <path fill="#FFD500" d="m16.6 8.8 3.8 2.2c.8.5.8 1.5 0 2l-3.8 2.2-3.2-3.2z" />
      <path fill="#FF3A44" d="m13.4 12 3.2 3.2-11.8 6.4c-.5.3-.9.3-1.2.1z" />
    </svg>
  )
}

/**
 * The store badges on /download. There is no store listing yet, so they install
 * the web app natively where the browser allows it; everywhere else they take
 * the visitor to the step-by-step panel for their device.
 */
export default function StoreButtons() {
  const { installEvent, isStandalone, install } = usePwaStore()

  const onClick = async (store: 'app_store' | 'google_play') => {
    track('pwa_install_clicked', { source: store })
    if (installEvent) { await install(); return }
    document.getElementById('install-steps')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (isStandalone) return null

  const base = 'flex items-center gap-3 bg-white text-black font-bold px-6 py-3.5 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition'
  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
      <button onClick={() => onClick('app_store')} className={base}>
        <AppleLogo size={30} weight="fill" className="text-black" />
        <div className="text-left">
          <p className="text-[10px] font-normal">Download on the</p>
          <p className="text-base font-black leading-tight">App Store</p>
        </div>
      </button>
      <button onClick={() => onClick('google_play')} className={base}>
        <GooglePlayMark size={28} />
        <div className="text-left">
          <p className="text-[10px] font-normal">Get it on</p>
          <p className="text-base font-black leading-tight">Google Play</p>
        </div>
      </button>
    </div>
  )
}
