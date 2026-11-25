'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useAllSeries, useHeroSeries } from '@/hooks'
import { Play, X } from '@/components/ui/icons'
import { track } from '@/lib/analytics'
import type { Series } from '@/types'

const FIRST_OPEN_KEY = 'dq.firstOpenDone'
const PROMO_DAY_KEY = 'dq.promoShownOn'

const safeGet = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
const today = () => new Date().toLocaleDateString('en-CA')   // YYYY-MM-DD, viewer's own day

/** Pages where a popup would get in the way */
const hiddenOn = (p: string | null) => !p || p.startsWith('/admin') || p.startsWith('/watch') || p.startsWith('/auth') || p.startsWith('/payment')

/**
 * Two small welcome moments, never both at once:
 *  - the very first visit: "Pick a drama to start with"
 *  - after that, once a day: a "New hit alert" card for the newest drama
 */
export default function WelcomePrompts() {
  const pathname = usePathname()
  const { data: all = [] } = useAllSeries()
  const { data: hero = [] } = useHeroSeries()
  const [mode, setMode] = useState<null | 'picks' | 'promo'>(null)

  const published = all
    .filter(s => s.is_published !== false && s.total_episodes > 0)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))   // newest first
  const ready = published.length > 0

  useEffect(() => {
    if (hiddenOn(pathname) || !ready || mode) return
    const first = !safeGet(FIRST_OPEN_KEY)
    const seenToday = safeGet(PROMO_DAY_KEY) === today()
    if (!first && seenToday) return
    const t = setTimeout(() => setMode(first ? 'picks' : 'promo'), first ? 1500 : 4000)
    return () => clearTimeout(t)
  }, [pathname, ready, mode])

  const close = (how: string) => {
    track('welcome_prompt_closed', { mode, how })
    safeSet(FIRST_OPEN_KEY, '1')
    safeSet(PROMO_DAY_KEY, today())
    setMode(null)
  }

  if (!mode || typeof document === 'undefined') return null

  // Newest drama first (the hero feed is already newest-first)
  const newest: Series | undefined = (hero as Series[])[0] ?? published[0]
  const picks = published.slice(0, 4)

  return createPortal(
    mode === 'picks' ? (
      <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={() => close('backdrop')}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-sm max-h-full overflow-y-auto bg-brand-card border border-brand-border rounded-2xl p-5 animate-slide-up">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-white font-bold text-lg leading-tight">Pick a drama to start with</h2>
            <button onClick={() => close('x')} aria-label="Close" className="text-brand-subtle hover:text-white -mr-1"><X size={20} /></button>
          </div>
          <p className="text-brand-subtle text-xs mb-4">Tap one to start watching free.</p>
          <div className="grid grid-cols-2 gap-3">
            {picks.map(s => (
              <Link key={s.id} href={`/watch/${s.slug}`} onClick={() => { track('first_open_pick', { series: s.slug }); close('pick') }} className="group">
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black/40">
                  <Image src={s.thumbnail_url} alt={s.title} fill sizes="160px" className="object-cover group-active:scale-105 transition-transform" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-10 h-10 rounded-full bg-black/55 backdrop-blur flex items-center justify-center"><Play size={18} fill="white" className="text-white ml-0.5" /></span>
                  </span>
                </div>
                <p className="text-white text-xs font-semibold mt-1.5 line-clamp-1">{s.title}</p>
                <p className="text-brand-subtle text-[11px]">{s.genre}</p>
              </Link>
            ))}
          </div>
          <button onClick={() => close('skip')} className="w-full text-brand-subtle hover:text-white text-sm font-semibold mt-4 py-2">Skip for now</button>
        </div>
      </div>
    ) : newest ? (
      <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => close('backdrop')}>
        <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[17rem] animate-scale-in">
          <button onClick={() => close('x')} aria-label="Close" className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-black/70 border border-white/20 flex items-center justify-center"><X size={16} className="text-white" /></button>
          <div className="rounded-2xl overflow-hidden bg-brand-card border border-brand-border">
            <p className="text-center text-white font-black text-sm tracking-wide uppercase pt-4">New hit alert</p>
            <p className="text-center text-brand-subtle text-[11px] pb-3">Now streaming free on Dramatique</p>
            <div className="relative aspect-[3/4] mx-4 rounded-xl overflow-hidden bg-black/40">
              <Image src={newest.hero_url || newest.thumbnail_url} alt={newest.title} fill sizes="260px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <div className="absolute left-3 right-3 bottom-3">
                <p className="text-white font-black text-lg leading-tight">{newest.title}</p>
                <p className="text-white/70 text-[11px] mt-0.5">{newest.genre} · {newest.total_episodes} episodes</p>
              </div>
            </div>
            <Link
              href={`/watch/${newest.slug}`}
              onClick={() => { track('promo_card_start', { series: newest.slug }); close('start') }}
              className="btn-primary flex items-center justify-center gap-2 mx-4 my-4 py-3 text-sm"
            >
              <Play size={16} fill="white" /> Start Watching
            </Link>
          </div>
        </div>
      </div>
    ) : null,
    document.body,
  )
}
