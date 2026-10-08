'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import VideoPlayer from '@/components/player/VideoPlayer'
import { useSwipeFeed, usePlaybackTicket, useSavedIds, useToggleSave, useSaveProgress } from '@/hooks'
import { useUIStore } from '@/store/uiStore'
import { Play, Bookmark, Check, Share2, ChevronUp, ChevronDown, Volume2, VolumeX, Crown, RotateCcw } from '@/components/ui/icons'
import type { SwipeItem } from '@/types'

const ADVANCE_AFTER_S = 6

function ShortCard({
  item, active, preload, muted, onMutedChange, onNext, hasNext,
}: {
  item: SwipeItem
  active: boolean
  preload: boolean
  muted: boolean
  onMutedChange: (m: boolean) => void
  onNext: () => void
  hasNext: boolean
}) {
  const { series, episode } = item
  const { data: ticket, isError } = usePlaybackTicket(episode?.id, active || preload)
  const { data: savedIds = [] } = useSavedIds()
  const toggleSave = useToggleSave()
  const saveProgress = useSaveProgress()
  const showToast = useUIStore(s => s.showToast)

  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [ended, setEnded] = useState(false)
  const [countdown, setCountdown] = useState(ADVANCE_AFTER_S)
  const [replayKey, setReplayKey] = useState(0)

  // Leaving a card resets it, so coming back starts clean
  useEffect(() => {
    if (!active) { setPaused(false); setEnded(false); setProgress(0) }
  }, [active])

  // End card: count down one tick at a time, then move on to the next drama
  useEffect(() => {
    if (!ended || !active || !hasNext) return
    if (countdown <= 0) { onNext(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [ended, active, hasNext, countdown, onNext])

  const saved = savedIds.includes(series.id)
  const playable = !!episode && !!ticket && !isError
  const nextEp = (episode?.episode_number ?? 0) + 1

  const share = async () => {
    const url = `${window.location.origin}/series/${series.slug}`
    try {
      if (navigator.share) await navigator.share({ title: series.title, text: `Watch ${series.title} on Dramatique`, url })
      else { await navigator.clipboard.writeText(url); showToast('Link copied 🔗', 'success') }
    } catch { /* share sheet dismissed */ }
  }

  return (
    <div className="relative h-full w-full md:h-[calc(100%-5.5rem)] md:mt-14 md:w-auto md:aspect-[9/16] md:rounded-2xl overflow-hidden bg-black md:ring-1 md:ring-white/10 md:shadow-2xl">
      {/* Media: the episode when it's ready, otherwise a slow-moving poster */}
      {active && playable ? (
        <VideoPlayer
          key={`${ticket!.episode_id}-${replayKey}`}
          src={ticket!.url}
          poster={episode!.thumbnail_url || series.thumbnail_url}
          controls={false}
          muted={muted}
          paused={paused || ended}
          onMutedFallback={() => onMutedChange(true)}
          onTick={(pos, dur) => setProgress(pos / dur)}
          onProgress={pos => saveProgress.mutate({ episodeId: episode!.id, positionSeconds: pos })}
          onEnded={dur => {
            saveProgress.mutate({ episodeId: episode!.id, positionSeconds: dur, completed: true })
            setCountdown(ADVANCE_AFTER_S)
            setEnded(true)
          }}
        />
      ) : (
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={episode?.thumbnail_url || series.thumbnail_url}
            alt={series.title} fill sizes="(min-width: 768px) 480px, 100vw"
            className={`object-cover ${active ? 'animate-ken-burns' : ''}`}
            priority={active}
          />
        </div>
      )}

      {/* Tap anywhere to pause / resume */}
      {playable && !ended && (
        <button
          onClick={() => setPaused(p => !p)}
          aria-label={paused ? 'Play' : 'Pause'}
          className="absolute inset-0 z-[1] flex items-center justify-center"
        >
          {paused && (
            <span className="w-16 h-16 rounded-full bg-black/45 backdrop-blur flex items-center justify-center animate-scale-in">
              <Play size={30} fill="white" className="text-white ml-1" />
            </span>
          )}
        </button>
      )}

      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/90 via-black/10 to-black/40" />

      {/* Sound toggle */}
      {playable && (
        <button
          onClick={() => onMutedChange(!muted)}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className={`absolute top-20 md:top-4 left-4 z-[2] flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur text-white text-xs font-semibold transition-all ${muted ? 'px-3 py-2' : 'p-2'}`}
        >
          {muted ? <><VolumeX size={16} /> Tap for sound</> : <Volume2 size={16} />}
        </button>
      )}

      {/* Right-hand action rail */}
      <div className="absolute right-3 bottom-36 md:bottom-28 z-[2] flex flex-col items-center gap-5">
        <button onClick={() => toggleSave.mutate(series.id)} aria-label={saved ? 'Remove from My List' : 'Add to My List'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
          <span className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur ${saved ? 'bg-brand-red' : 'bg-black/45'}`}>
            {saved ? <Check size={20} className="text-white" /> : <Bookmark size={20} className="text-white" />}
          </span>
          <span className="text-white text-[10px] font-semibold drop-shadow">{saved ? 'Saved' : 'My List'}</span>
        </button>
        <button onClick={share} aria-label="Share" className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
          <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur flex items-center justify-center"><Share2 size={20} className="text-white" /></span>
          <span className="text-white text-[10px] font-semibold drop-shadow">Share</span>
        </button>
      </div>

      {/* Story info + the way into the full series */}
      <div className="absolute left-0 right-16 bottom-0 z-[2] p-4 pb-24 md:pb-6">
        <div className="flex items-center gap-2 mb-1.5">
          {series.is_vip && <span className="flex items-center gap-1 bg-brand-gold text-black text-[9px] font-black px-1.5 py-0.5 rounded uppercase"><Crown size={9} className="fill-black" />VIP</span>}
          <span className="text-brand-red text-[11px] font-black uppercase tracking-widest">{series.genre}</span>
          <span className="text-white/60 text-[11px]">· {episode ? `Episode ${episode.episode_number} of ${series.total_episodes}` : `${series.total_episodes} episodes · video soon`}</span>
        </div>
        <h2 className="text-white font-bold text-xl leading-tight drop-shadow">{series.title}</h2>
        <p className="text-white/80 text-[13px] leading-snug mt-1 line-clamp-2">{series.synopsis}</p>
        <Link
          href={`/series/${series.slug}`}
          className="pointer-events-auto mt-3 inline-flex items-center gap-2 bg-white/15 hover:bg-brand-red backdrop-blur-md border border-white/20 hover:border-brand-red text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Play size={14} fill="white" /> {episode ? 'Watch full series' : 'View series'} · {series.total_episodes} eps
        </Link>
      </div>

      {/* Episode finished: hand over to the series page, or roll on to the next drama */}
      {ended && (
        <div className="absolute inset-0 z-[3] bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center px-8 text-center animate-fade-in">
          <p className="text-brand-red text-[11px] font-black uppercase tracking-widest mb-2">Episode {episode?.episode_number} finished</p>
          <h3 className="text-white font-bold text-2xl mb-5 leading-tight">Don&apos;t stop now</h3>
          <Link href={`/series/${series.slug}`} className="btn-primary w-full max-w-[240px] py-3 flex items-center justify-center gap-2 mb-3">
            <Play size={16} fill="white" /> Continue to Episode {nextEp}
          </Link>
          <button onClick={() => { setEnded(false); setProgress(0); setReplayKey(k => k + 1) }} className="text-white/70 hover:text-white text-sm flex items-center gap-1.5">
            <RotateCcw size={14} /> Replay
          </button>
          {hasNext && <p className="text-white/50 text-xs mt-6">Next drama in {countdown}s</p>}
        </div>
      )}

      {/* Episode progress */}
      {playable && (
        <div className="absolute left-0 right-0 bottom-0 z-[2] h-0.5 bg-white/15 md:mb-0 mb-[4.25rem]">
          <div className="h-full bg-brand-red transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  )
}

export default function ShortsPage() {
  const { data: items, isLoading, isError, refetch } = useSwipeFeed()
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(false)

  // Cards are exactly one screen tall and snap, so the scroll offset says
  // which one is on screen (sturdier than IntersectionObserver in hidden tabs)
  const onScroll = useCallback(() => {
    const root = scroller.current
    if (!root || !root.clientHeight) return
    setActive(Math.round(root.scrollTop / root.clientHeight))
  }, [])

  const go = useCallback((dir: 1 | -1) => {
    const root = scroller.current
    if (!root || !root.clientHeight) return
    const h = root.clientHeight
    const target = Math.max(0, Math.min(root.scrollHeight - h, (Math.round(root.scrollTop / h) + dir) * h))
    setActive(Math.round(target / h))
    root.scrollTo({ top: target, behavior: 'smooth' })
    // Smooth scrolling is skipped by some browsers (reduced motion, background
    // tabs) — make sure we always arrive
    setTimeout(() => { if (Math.abs(root.scrollTop - target) > 2) root.scrollTop = target }, 700)
  }, [])
  const next = useCallback(() => go(1), [go])

  // Desktop: arrow keys / J-K move between dramas, M toggles sound
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); go(-1) }
      if (e.key === 'm') setMuted(m => !m)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (isLoading) {
    return (
      <main className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  if (isError || !items?.length) {
    return (
      <main className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">🎬</div>
        <h1 className="text-white font-bold text-xl mb-2">{isError ? "Couldn't load Shorts" : 'Nothing here yet'}</h1>
        <p className="text-brand-subtle text-sm mb-6">{isError ? 'Check your connection and try again.' : 'New dramas are on the way.'}</p>
        {isError && <button onClick={() => refetch()} className="btn-primary px-8 py-3">Try Again</button>}
      </main>
    )
  }

  return (
    <main className="fixed inset-0 bg-black">
      <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-scroll snap-y snap-mandatory scroll-hide overscroll-contain">
        {items.map((item, i) => (
          <section key={item.series.id} data-index={i} className="relative h-full w-full snap-start snap-always flex items-start md:items-center justify-center overflow-hidden">
            {/* Desktop: blurred poster fills the space around the 9:16 frame */}
            <div className="hidden md:block absolute inset-0">
              <Image src={item.series.thumbnail_url} alt="" fill sizes="100vw" className="object-cover blur-3xl scale-110 opacity-35" />
            </div>
            {Math.abs(i - active) <= 2 && (
              <ShortCard
                item={item}
                active={i === active}
                preload={i === active + 1}
                muted={muted}
                onMutedChange={setMuted}
                onNext={next}
                hasNext={i < items.length - 1}
              />
            )}
          </section>
        ))}
      </div>

      {/* Desktop up/down controls */}
      <div className="hidden md:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col gap-3 z-10">
        <button onClick={() => go(-1)} disabled={active === 0} aria-label="Previous drama" className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/10 flex items-center justify-center disabled:opacity-30 transition-colors">
          <ChevronUp size={20} className="text-white" />
        </button>
        <button onClick={() => go(1)} disabled={active === items.length - 1} aria-label="Next drama" className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/10 flex items-center justify-center disabled:opacity-30 transition-colors">
          <ChevronDown size={20} className="text-white" />
        </button>
      </div>

      {/* First-visit hint */}
      {active === 0 && (
        <div className="md:hidden fixed top-[38%] left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center text-white/70 text-xs animate-bounce">
          <ChevronUp size={18} /> Swipe up for more
        </div>
      )}
    </main>
  )
}
