'use client'

import { usePwaStore } from '@/store/pwaStore'
import { Globe, Download, CheckCircle } from '@/components/ui/icons'
import InstallSteps from './InstallSteps'

/** "Add to Home Screen" panel on /download — a real install button where the browser supports it */
export default function InstallCard() {
  const { installEvent, isStandalone, manualInstall, install } = usePwaStore()

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
            {(manualInstall
              ? [{ platform: manualInstall === 'mac-safari' ? '💻 Mac' : '📱 iPhone / iPad', steps: <InstallSteps kind={manualInstall} /> }]
              : [
                  { platform: '📱 iPhone / iPad', steps: <>Share → Add to Home Screen</> },
                  { platform: '💻 Mac Safari', steps: <>File → Add to Dock</> },
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
