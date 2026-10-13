'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import PaywallModal from '@/components/monetisation/PaywallModal'
import VideoPlayer from '@/components/player/VideoPlayer'
import { usePlaybackTicket, useSeriesDetail, useSeriesAccess, useSavedIds, useToggleSave, useUnlockEpisode, useSaveProgress } from '@/hooks'
import { useCoinStore } from '@/store'
import { useUIStore } from '@/store/uiStore'
import { Play, Lock, Bookmark, Check, Share2, ArrowLeft, Volume2, VolumeX, RotateCcw, ChevronUp, ChevronDown } from '@/components/ui/icons'
import type { Episode, SeriesDetail } from '@/types'

// Same key the series page uses — opting in once applies to every binge
const AUTO_UNLOCK_KEY = 'dq.autoUnlock'

interface AccessInfo { is_vip?: boolean; can_watch_all?: boolean; unlocked_episode_ids?: string[] }

function EpisodeCard({
  series, episode, locked, active, preload, muted, onMutedChange, onFinished, onUnlockClick, isLast, nextAvailable, onReplay,
}: {
  series: SeriesDetail
  episode: Episode
  locked: boolean
  active: boolean
  preload: boolean
  muted: boolean
  onMutedChange: (m: boolean) => void
  onFinished: () => void
  onUnlockClick: () => void
  isLast: boolean
  nextAvailable: boolean
  onReplay: () => void
}) {
  const { data: ticket, isError } = usePlaybackTicket(episode.id, !locked && (active || preload))
  const saveProgress = useSaveProgress()
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [replayKey, setReplayKey] = useState(0)

  // Leaving a card resets it so coming back starts clean
  useEffect(() => {
    if (!active) { setPaused(false); setProgress(0); setDone(false) }
  }, [active])

  const poster = episode.thumbnail_url || series.thumbnail_url
  const playable = !locked && !!ticket && !isError
  // A finished episode saves its end as the resume point — replay from the top instead
  const resume = ticket && ticket.duration_seconds && ticket.resume_position_seconds >= ticket.duration_seconds - 3 ? 0 : ticket?.resume_position_seconds ?? 0

  return (
    <div className="relative h-full w-full md:h-[calc(100%-2rem)] md:w-auto md:aspect-[9/16] md:rounded-2xl overflow-hidden bg-black md:ring-1 md:ring-white/10 md:shadow-2xl">
      {playable ? (
        // The next card mounts paused: its stream is already buffered when its turn comes
        <VideoPlayer
          key={`${ticket!.episode_id}-${replayKey}`}
          src={ticket!.url}
          poster={poster}
          startAt={replayKey ? 0 : resume}
          controls={false}
          fit="cover"
          muted={muted}
          paused={!active || paused || done}
          quiet={!active}
          onMutedFallback={() => onMutedChange(true)}
          onTick={(pos, dur) => { if (active) setProgress(pos / dur) }}
          onProgress={pos => { if (active) saveProgress.mutate({ episodeId: episode.id, positionSeconds: pos }) }}
          onEnded={dur => {
            if (!active) return
            saveProgress.mutate({ episodeId: episode.id, positionSeconds: dur, completed: true })
            setDone(true)
            onFinished()
          }}
        />
      ) : (
        <div className="absolute inset-0">
          <Image src={poster} alt={series.title} fill sizes="(min-width: 768px) 480px, 100vw" className="object-cover" priority={active} />
          {!locked && active && !isError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="w-9 h-9 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Tap anywhere to pause / resume */}
      {playable && active && !done && (
        <button onClick={() => setPaused(p => !p)} aria-label={paused ? 'Play' : 'Pause'} className="absolute inset-0 z-[1] flex items-center justify-center">
          {paused && (
            <span className="w-16 h-16 rounded-full bg-black/45 backdrop-blur flex items-center justify-center animate-scale-in">
              <Play size={30} fill="white" className="text-white ml-1" />
            </span>
          )}
        </button>
      )}

      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/30" />

      {/* Locked: the only thing that ever interrupts the flow */}
      {locked && (
        <div className="absolute inset-0 z-[2] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center px-8 text-center">
          <div className="w-14 h-14 rounded-full bg-brand-gold/15 flex items-center justify-center mb-3"><Lock size={26} className="text-brand-gold" /></div>
          <p className="text-white font-bold text-lg mb-1">Episode {episode.episode_number} is locked</p>
          <p className="text-brand-subtle text-sm mb-5">Unlock to keep watching</p>
          <button onClick={onUnlockClick} className="btn-primary px-8 py-3">
            {episode.access_type === 'VIP_ONLY' ? 'Go VIP' : `🪙 Unlock · ${episode.coin_price} coins`}
          </button>
        </div>
      )}

      {isError && !locked && active && (
        <div className="absolute inset-0 z-[2] bg-black/70 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-white font-semibold text-sm">This episode is coming soon</p>
        </div>
      )}

      {/* Story info — minimal, never covers the picture */}
      <div className="absolute left-0 right-16 bottom-0 z-[2] p-4 pb-20 md:pb-6 pointer-events-none">
        <h2 className="text-white font-bold text-lg leading-tight drop-shadow">{series.title}</h2>
        <p className="text-white/70 text-xs mt-0.5">Episode {episode.episode_number} of {series.total_episodes}{episode.title ? ` · ${episode.title}` : ''}</p>
      </div>

      {/* End of the line: only shows when there is genuinely nothing to roll into */}
      {done && isLast && (
        <div className="absolute inset-0 z-[3] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center px-8 text-center animate-fade-in">
          <p className="text-brand-red text-[11px] font-black uppercase tracking-widest mb-2">
            {nextAvailable ? 'Episode finished' : 'You are all caught up'}
          </p>
          <h3 className="text-white font-bold text-2xl mb-5 leading-tight">
            {nextAvailable ? 'Loading next episode' : 'More episodes are on the way'}
          </h3>
          <Link href="/shorts" className="btn-primary w-full max-w-[240px] py-3 flex items-center justify-center gap-2 mb-3">
            <Play size={16} fill="white" /> Discover another drama
          </Link>
          <button onClick={() => { setDone(false); setProgress(0); setReplayKey(k => k + 1); onReplay() }} className="text-white/70 hover:text-white text-sm flex items-center gap-1.5">
            <RotateCcw size={14} /> Replay episode
          </button>
        </div>
      )}

      {playable && active && (
        <div className="absolute left-0 right-0 bottom-0 z-[2] h-0.5 bg-white/15">
          <div className="h-full bg-brand-red transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  )
}

function WatchInner({ slug }: { slug: string }) {
  const params = useSearchParams()
  const epParam = Number(params.get('ep')) || 0
  const { data: series, isError } = useSeriesDetail(slug)
  const { data: access, isError: accessError } = useSeriesAccess(series?.id)
  const { data: savedIds = [] } = useSavedIds()
  const toggleSave = useToggleSave()
  const unlock = useUnlockEpisode()
  const balance = useCoinStore(s => s.balance)
  const showToast = useUIStore(s => s.showToast)

  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [arrivedByAutoplay, setArrivedByAutoplay] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [autoUnlock, setAutoUnlockState] = useState(false)
  const [gaveUp, setGaveUp] = useState(false)
  const autoplayNav = useRef(false)

  useEffect(() => { try { setAutoUnlockState(localStorage.getItem(AUTO_UNLOCK_KEY) === '1') } catch { /* storage blocked */ } }, [])
  const setAutoUnlock = (v: boolean) => {
    setAutoUnlockState(v)
    try { localStorage.setItem(AUTO_UNLOCK_KEY, v ? '1' : '0') } catch { /* storage blocked */ }
  }
  // Don't hold the viewer hostage if the access lookup is slow
  useEffect(() => { const t = setTimeout(() => setGaveUp(true), 3000); return () => clearTimeout(t) }, [])

  const episodes = series ? [...series.episodes].sort((a, b) => a.episode_number - b.episode_number) : []
  const accessReady = !!access || accessError || gaveUp || epParam > 0

  const isLocked = useCallback((ep: Episode) => {
    const a = access as AccessInfo | undefined
    if (ep.access_type === 'FREE' || a?.is_vip || a?.can_watch_all) return false
    return !(a?.unlocked_episode_ids ?? []).includes(ep.id)
  }, [access])

  // Open on the requested / last-watched episode, once
  const started = useRef(false)
  useEffect(() => {
    const root = scroller.current
    if (started.current || !series || !episodes.length || !accessReady || !root) return
    started.current = true
    const want = epParam || access?.last_episode || 1
    const idx = Math.max(0, episodes.findIndex(e => e.episode_number === want))
    root.scrollTop = idx * root.clientHeight
    setActive(idx)
  })

  const go = useCallback((dir: 1 | -1) => {
    const root = scroller.current
    if (!root || !root.clientHeight) return
    const h = root.clientHeight
    const target = Math.max(0, Math.min(root.scrollHeight - h, (Math.round(root.scrollTop / h) + dir) * h))
    setActive(Math.round(target / h))
    root.scrollTo({ top: target, behavior: 'smooth' })
    setTimeout(() => { if (Math.abs(root.scrollTop - target) > 2) root.scrollTop = target }, 700)
  }, [])

  const jumpTo = (idx: number) => {
    const root = scroller.current
    if (!root) return
    setPickerOpen(false)
    setActive(idx)
    root.scrollTo({ top: idx * root.clientHeight, behavior: 'auto' })
  }

  const onScroll = useCallback(() => {
    const root = scroller.current
    if (!root || !root.clientHeight || !started.current) return
    const idx = Math.round(root.scrollTop / root.clientHeight)
    setActive(prev => {
      if (prev !== idx) autoplayNav.current = false // a manual swipe, not the binge loop
      return idx
    })
  }, [])

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

  // When the viewer lands on a locked episode: auto-unlock if they opted in and
  // can afford it, otherwise show the paywall — the only interruption there is.
  const activeEpisode = active !== null ? episodes[active] : undefined
  const lockedActive = !!activeEpisode && isLocked(activeEpisode)
  const handledFor = useRef<string | null>(null)
  useEffect(() => {
    if (!series || !activeEpisode || !lockedActive) { setPaywallOpen(false); return }
    if (handledFor.current === activeEpisode.id) return
    handledFor.current = activeEpisode.id
    setArrivedByAutoplay(autoplayNav.current)
    if (autoUnlock && activeEpisode.access_type === 'COIN_LOCKED' && balance >= activeEpisode.coin_price) {
      unlock.mutate({ episodeId: activeEpisode.id, coinCost: activeEpisode.coin_price, seriesId: series.id })
    } else {
      setPaywallOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEpisode?.id, lockedActive])

  if (isError) {
    return (
      <main className="fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-white font-bold text-xl mb-2">Series not found</h1>
        <Link href="/" className="btn-primary px-8 py-3 mt-4">Back home</Link>
      </main>
    )
  }

  const saved = !!series && savedIds.includes(series.id)
  const share = async () => {
    if (!series) return
    const url = `${window.location.origin}/series/${series.slug}`
    try {
      if (navigator.share) await navigator.share({ title: series.title, text: `Watch ${series.title} on Dramatique`, url })
      else { await navigator.clipboard.writeText(url); showToast('Link copied 🔗', 'success') }
    } catch { /* share sheet dismissed */ }
  }

  return (
    <main className="fixed inset-0 z-[70] bg-black">
      <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-scroll snap-y snap-mandatory scroll-hide overscroll-contain">
        {series && episodes.map((ep, i) => (
          <section key={ep.id} className="relative h-full w-full snap-start snap-always flex items-start md:items-center justify-center overflow-hidden">
            <div className="hidden md:block absolute inset-0">
              <Image src={series.thumbnail_url} alt="" fill sizes="100vw" className="object-cover blur-3xl scale-110 opacity-35" />
            </div>
            {active !== null && Math.abs(i - active) <= 1 && (
              <EpisodeCard
                series={series}
                episode={ep}
                locked={isLocked(ep)}
                active={i === active}
                preload={i === active + 1}
                muted={muted}
                onMutedChange={setMuted}
                onFinished={() => {
                  if (i < episodes.length - 1) { autoplayNav.current = true; go(1) }
                }}
                onUnlockClick={() => setPaywallOpen(true)}
                isLast={i === episodes.length - 1}
                nextAvailable={ep.episode_number < series.total_episodes}
                onReplay={() => { /* local to the card */ }}
              />
            )}
          </section>
        ))}
      </div>

      {(!series || active === null) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Quiet chrome: back, episode counter, sound */}
      {series && activeEpisode && (
        <>
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 md:px-6 pointer-events-none bg-gradient-to-b from-black/50 to-transparent">
            <Link href={`/series/${series.slug}`} aria-label="Back to series" className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center active:scale-90 transition-transform">
              <ArrowLeft size={20} className="text-white" />
            </Link>
            <button onClick={() => setPickerOpen(true)} className="pointer-events-auto bg-black/40 backdrop-blur text-white text-xs font-bold px-3 py-2 rounded-full">
              EP {activeEpisode.episode_number} / {series.total_episodes} ▾
            </button>
            <button onClick={() => setMuted(m => !m)} aria-label={muted ? 'Unmute' : 'Mute'} className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
              {muted ? <VolumeX size={18} className="text-white" /> : <Volume2 size={18} className="text-white" />}
            </button>
          </div>

          {/* Side rail */}
          <div className="absolute right-3 bottom-28 md:right-[calc(50%-14rem)] z-10 flex flex-col items-center gap-5">
            <button onClick={() => toggleSave.mutate(series.id)} aria-label={saved ? 'Remove from My List' : 'Add to My List'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <span className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur ${saved ? 'bg-brand-red' : 'bg-black/45'}`}>
                {saved ? <Check size={20} className="text-white" /> : <Bookmark size={20} className="text-white" />}
              </span>
            </button>
            <button onClick={share} aria-label="Share" className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur flex items-center justify-center"><Share2 size={20} className="text-white" /></span>
            </button>
          </div>

          {/* Desktop up/down */}
          <div className="hidden md:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col gap-3 z-10">
            <button onClick={() => go(-1)} disabled={active === 0} aria-label="Previous episode" className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/10 flex items-center justify-center disabled:opacity-30">
              <ChevronUp size={20} className="text-white" />
            </button>
            <button onClick={() => go(1)} disabled={active === episodes.length - 1} aria-label="Next episode" className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/10 flex items-center justify-center disabled:opacity-30">
              <ChevronDown size={20} className="text-white" />
            </button>
          </div>
        </>
      )}

      {/* Episode picker */}
      {pickerOpen && series && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-end md:items-center justify-center" onClick={() => setPickerOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full md:max-w-md max-h-[70vh] overflow-y-auto bg-brand-card rounded-t-2xl md:rounded-2xl p-4">
            <h3 className="text-white font-bold text-sm mb-3">Episodes</h3>
            <div className="grid grid-cols-6 gap-2">
              {episodes.map((ep, i) => (
                <button key={ep.id} onClick={() => jumpTo(i)}
                  className={`aspect-square rounded-lg text-xs font-bold flex items-center justify-center border relative ${i === active ? 'bg-brand-red border-brand-red text-white' : isLocked(ep) ? 'bg-brand-card border-brand-border text-brand-muted' : 'bg-green-500/5 border-green-500/20 text-brand-text'}`}>
                  {ep.episode_number}
                  {isLocked(ep) && i !== active && <Lock size={8} className="text-brand-gold/70 absolute top-1 right-1" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {series && activeEpisode && (
        <PaywallModal
          isOpen={paywallOpen && lockedActive}
          onClose={() => setPaywallOpen(false)}
          episodeNumber={activeEpisode.episode_number}
          coinCost={activeEpisode.coin_price}
          seriesTitle={series.title}
          posterUrl={activeEpisode.thumbnail_url || series.thumbnail_url}
          episodeTitle={activeEpisode.title}
          justFinished={arrivedByAutoplay}
          autoUnlock={autoUnlock}
          onAutoUnlockChange={setAutoUnlock}
          vipOnly={activeEpisode.access_type === 'VIP_ONLY'}
          onUnlock={() => unlock.mutate(
            { episodeId: activeEpisode.id, coinCost: activeEpisode.coin_price, seriesId: series.id },
            { onSuccess: () => setPaywallOpen(false) },
          )}
          unlocking={unlock.isPending}
        />
      )}
    </main>
  )
}

export default function WatchPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={<main className="fixed inset-0 z-[70] bg-black" />}>
      <WatchInner slug={params.slug} />
    </Suspense>
  )
}
