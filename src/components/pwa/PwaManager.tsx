'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePwaStore, type BeforeInstallPromptEvent } from '@/store/pwaStore'
import { Download, ShareIOS, PlusSquare, X } from '@/components/ui/icons'

const DISMISS_KEY = 'dq_install_dismissed_at'
const VISITS_KEY = 'dq_visits'
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000

function safeGet(store: Storage, key: string) {
  try { return store.getItem(key) } catch { return null }
}
function safeSet(store: Storage, key: string, value: string) {
  try { store.setItem(key, value) } catch { /* private mode */ }
}

/**
 * Registers the service worker, tracks installability and shows a small
 * "Install Dramatique" card to returning mobile visitors on the home page.
 */
export default function PwaManager() {
  const pathname = usePathname()
  const { installEvent, isStandalone, isIOS, setInstallEvent, setEnvironment, install } = usePwaStore()
  const [show, setShow] = useState(false)

  // Service worker — production only, so it never serves stale chunks during `next dev`
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker registration failed', err))
  }, [])

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    const ua = navigator.userAgent
    // iPadOS reports itself as a Mac, so also check for touch
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
    const iosSafari = ios && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
    setEnvironment({ isStandalone: standalone, isIOS: iosSafari })

    // Count one visit per browser session
    if (!safeGet(sessionStorage, VISITS_KEY)) {
      safeSet(sessionStorage, VISITS_KEY, '1')
      safeSet(localStorage, VISITS_KEY, String(Number(safeGet(localStorage, VISITS_KEY) ?? 0) + 1))
    }

    const onPrompt = (e: Event) => {
      e.preventDefault() // we show our own card instead of Chrome's mini-infobar
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstallEvent(null)
      setShow(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [setEnvironment, setInstallEvent])

  // Nudge only on the home page, from the second visit, unless recently dismissed
  useEffect(() => {
    setShow(false)
    if (pathname !== '/' || isStandalone || !(installEvent || isIOS)) return
    if (Number(safeGet(localStorage, VISITS_KEY) ?? 0) < 2) return
    if (Date.now() - Number(safeGet(localStorage, DISMISS_KEY) ?? 0) < DISMISS_FOR_MS) return
    const t = setTimeout(() => setShow(true), 6000)
    return () => clearTimeout(t)
  }, [pathname, isStandalone, installEvent, isIOS])

  if (!show) return null

  const dismiss = () => {
    safeSet(localStorage, DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Install Dramatique"
      className="fixed z-[60] left-3 right-3 bottom-[76px] md:left-auto md:right-6 md:bottom-6 md:w-96 bg-brand-card border border-brand-border rounded-2xl shadow-2xl p-4 animate-slide-up"
    >
      <button onClick={dismiss} aria-label="Not now" className="absolute top-2.5 right-2.5 p-1.5 text-brand-subtle hover:text-white transition-colors">
        <X size={16} />
      </button>
      <div className="flex items-center gap-3 pr-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-white font-bold text-sm">Install Dramatique</p>
          {installEvent ? (
            <p className="text-brand-subtle text-xs leading-relaxed">Full-screen dramas, one tap from your home screen.</p>
          ) : (
            <p className="text-brand-subtle text-xs leading-relaxed">
              Tap <ShareIOS size={14} className="inline -mt-0.5 text-white" /> then{' '}
              <span className="text-white whitespace-nowrap">Add to Home Screen <PlusSquare size={14} className="inline -mt-0.5" /></span>
            </p>
          )}
        </div>
      </div>
      {installEvent && (
        <button
          onClick={async () => { if (!(await install())) dismiss() }}
          className="btn-primary w-full mt-3 py-2.5 inline-flex items-center justify-center gap-2 text-sm"
        >
          <Download size={16} /> Install app
        </button>
      )}
    </div>
  )
}
