'use client'

import { usePwaStore } from '@/store/pwaStore'
import { Globe, Download, CheckCircle, ShareIOS, PlusSquare } from '@/components/ui/icons'

/** "Add to Home Screen" panel on /download — a real install button where the browser supports it */
export default function InstallCard() {
  const { installEvent, isStandalone, isIOS, install } = usePwaStore()

  return (
    <div className="bg-gradient-to-r from-brand-red/10 to-brand-dark border border-brand-red/20 rounded-2xl p-6 mb-10">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Globe size={20} className="text-brand-red" />
        <h3 className="text-white font-bold text-base">Add to Home Screen</h3>
      </div>

      {isStandalone ? (
        <p className="text-brand-subtle text-sm inline-flex items-center gap-2">
          <CheckCircle size={16} className="text-green-400" /> You're using the installed app.
        </p>
      ) : installEvent ? (
        <>
          <p className="text-brand-subtle text-sm mb-4">Install Dramatique as an app right now — no App Store needed.</p>
          <button onClick={install} className="btn-primary px-8 py-3 inline-flex items-center gap-2">
            <Download size={16} /> Install app
          </button>
        </>
      ) : (
        <>
          <p className="text-brand-subtle text-sm mb-4">Install Dramatique as an app right now — no App Store needed.</p>
          <div className="text-left space-y-2">
            {(isIOS
              ? [{ platform: '📱 iPhone / iPad', steps: <>Safari → <ShareIOS size={13} className="inline -mt-0.5" /> Share → Add to Home Screen <PlusSquare size={13} className="inline -mt-0.5" /></> }]
              : [
                  { platform: '📱 iPhone', steps: <>Safari → Share → Add to Home Screen</> },
                  { platform: '🤖 Android', steps: <>Chrome → Menu (⋮) → Install app / Add to Home Screen</> },
                  { platform: '💻 Desktop', steps: <>Chrome or Edge → install icon in the address bar</> },
                ]
            ).map(item => (
              <div key={item.platform} className="bg-brand-black/50 rounded-xl p-3">
                <p className="text-white font-bold text-xs mb-1">{item.platform}</p>
                <p className="text-brand-subtle text-xs">{item.steps}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
