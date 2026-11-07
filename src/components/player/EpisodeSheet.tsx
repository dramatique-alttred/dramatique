'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRecommended } from '@/hooks'
import { Lock, ChevronDown, ChevronUp } from '@/components/ui/icons'
import type { Episode, SeriesDetail } from '@/types'

const PAGE = 30

/** Equalizer bars that dance on the episode that is playing (still when the viewer prefers reduced motion) */
function NowPlaying() {
  return (
    <span className="absolute left-3 bottom-2 flex items-end gap-[2.5px] h-[11px]" role="img" aria-label="Now playing">
      <span className="eq-bar" style={{ animationDuration: '0.9s', animationDelay: '-0.2s' }} />
      <span className="eq-bar" style={{ animationDuration: '0.7s', animationDelay: '-0.5s' }} />
      <span className="eq-bar" style={{ animationDuration: '1.1s', animationDelay: '-0.1s' }} />
      <span className="eq-bar" style={{ animationDuration: '0.8s', animationDelay: '-0.7s' }} />
    </span>
  )
}

/**
 * Bottom sheet over the reel: the Synopsis and Episodes tabs, with the
 * episodes in a numbered grid (locked ones carry a padlock).
 */
export default function EpisodeSheet({
  series, episodes, active, isLocked, onJump, onClose,
}: {
  series: SeriesDetail
  episodes: Episode[]
  active: number
  isLocked: (ep: Episode) => boolean
  onJump: (index: number) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'synopsis' | 'episodes'>('episodes')
  const [range, setRange] = useState(Math.floor(Math.max(0, active) / PAGE))
  const [expanded, setExpanded] = useState(false)
  const { data: more = [] } = useRecommended(series.id)

  const pages = Math.ceil(episodes.length / PAGE)
  const visible = episodes.slice(range * PAGE, range * PAGE + PAGE)
  const tags = [series.genre, ...(series.tags ?? [])].filter(Boolean)

  const tabClass = (t: typeof tab) =>
    `text-lg font-bold transition-colors ${tab === t ? 'text-white' : 'text-brand-subtle'}`

  return (
    <div className="absolute inset-0 z-20 bg-black/40 flex items-end md:items-center justify-center animate-fade-in" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full md:max-w-md min-h-[52%] max-h-[78%] flex flex-col bg-[#2b2b2d] rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl animate-slide-up"
      >
        {/* grabber */}
        <button onClick={onClose} aria-label="Close" className="w-full flex justify-center pt-3 pb-2 flex-shrink-0">
          <span className="w-9 h-1 rounded-full bg-white/25" />
        </button>

        {/* series header */}
        <div className="flex items-center gap-4 px-5 pt-2 pb-4 flex-shrink-0">
          <div className="relative w-[68px] aspect-[3/4] rounded-lg overflow-hidden bg-black/40 flex-shrink-0">
            <Image src={series.thumbnail_url} alt="" fill sizes="68px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-base leading-snug line-clamp-2">{series.title}</p>
            <p className="text-brand-subtle text-xs mt-0.5">{series.total_episodes} episodes · {series.genre}</p>
          </div>
        </div>

        {/* tabs */}
        <div className="flex items-baseline gap-6 px-5 pb-3 flex-shrink-0">
          <button onClick={() => setTab('synopsis')} className={tabClass('synopsis')}>Synopsis</button>
          <button onClick={() => setTab('episodes')} className={tabClass('episodes')}>Episodes</button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-hide px-5 pb-8 overscroll-contain">
          {tab === 'episodes' ? (
            <>
              {pages > 1 && (
                <div className="flex gap-6 mb-4">
                  {Array.from({ length: pages }, (_, i) => (
                    <button key={i} onClick={() => setRange(i)} className={`text-sm font-semibold ${range === i ? 'text-white' : 'text-brand-subtle'}`}>
                      {i * PAGE + 1}-{Math.min((i + 1) * PAGE, episodes.length)}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-6 gap-2">
                {visible.map((ep, k) => {
                  const idx = range * PAGE + k
                  const current = idx === active
                  const locked = isLocked(ep)
                  return (
                    <button
                      key={ep.id}
                      onClick={() => onJump(idx)}
                      className={`relative aspect-square rounded-lg flex items-center justify-center text-sm font-bold text-white active:scale-95 transition ${current ? 'bg-white/30 pb-3' : 'bg-white/10 hover:bg-white/15'}`}
                    >
                      {ep.episode_number}
                      {current && <NowPlaying />}
                      {locked && !current && <Lock size={12} weight="fill" className="absolute top-2 right-2 text-white/90" />}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <p className={`text-brand-text text-sm leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>{series.synopsis}</p>
              {series.synopsis && series.synopsis.length > 140 && (
                <button onClick={() => setExpanded(v => !v)} className="text-white text-xs font-semibold mt-1 inline-flex items-center gap-1">
                  {expanded ? 'Less' : 'More'} {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                {tags.map(t => <span key={t} className="text-brand-text text-xs font-medium bg-white/10 rounded-md px-3 py-1.5">{t}</span>)}
              </div>

              {more.length > 0 && (
                <>
                  <h3 className="text-white font-bold text-lg mt-7 mb-3">More Like This</h3>
                  <div className="flex gap-3 overflow-x-auto scroll-hide pb-1">
                    {more.slice(0, 8).map(s => (
                      <Link key={s.id} href={`/watch/${s.slug}`} className="flex-shrink-0 w-[104px]">
                        <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-black/40">
                          <Image src={s.thumbnail_url} alt={s.title} fill sizes="104px" className="object-cover" />
                        </div>
                        <p className="text-brand-text text-xs font-medium mt-1.5 line-clamp-2 leading-snug">{s.title}</p>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
