'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import PaywallModal from '@/components/monetisation/PaywallModal'
import VideoPlayer from '@/components/player/VideoPlayer'
import EpisodeSheet from '@/components/player/EpisodeSheet'
import PlaybackSettings, { speedLabel } from '@/components/player/PlaybackSettings'
import type { QualityApi } from '@/components/player/VideoPlayer'
import { ScrubBar, TapHoldLayer } from '@/components/player/ReelControls'
import { usePlaybackTicket, useSeriesDetail, useSeriesAccess, useSavedIds, useToggleSave, useUnlockEpisode, useSaveProgress } from '@/hooks'
import { useCoinStore } from '@/store'
import { useUIStore } from '@/store/uiStore'
import { installOrContinue } from '@/store/pwaStore'
import { track } from '@/lib/analytics'
import { Play, Lock, AlertTriangle, Bookmark, Check, Share2, ArrowLeft, Volume2, VolumeX, RotateCcw, ChevronUp, ChevronDown, ListBullets, Crown, Download, Gauge, MoreVertical } from '@/components/ui/icons'
import type { Episode, SeriesDetail } from '@/types'

// Same key the series page uses — opting in once applies to every binge
const AUTO_UNLOCK_KEY = 'dq.autoUnlock'

interface AccessInfo { is_vip?: boolean; can_watch_all?: boolean; unlocked_episode_ids?: string[] }

function EpisodeCard({
  series, episode, locked, active, preload, muted, onMutedChange, onFinished, onUnlockClick, isLast, nextAvailable, onReplay, onOpenPicker, onUiVisible, activity, total, soundLocked, onSoundBlocked, onSoundUnlock, speed, qualityChoice, onMedia, hold,
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
  onOpenPicker: () => void
  onUiVisible: (visible: boolean) => void
  /** Bumps whenever a mouse moves over the page (desktop) */
  activity: number
  total: number
  /** The browser refused sound-on autoplay: the first tap switches sound on instead of pausing */
  soundLocked: boolean
  onSoundBlocked: () => void
  onSoundUnlock: () => void
  /** Playback Settings: speed and pinned quality apply to every episode */
  speed: number
  qualityChoice: 'auto' | number
  /** The active card reports its video + quality controls for the settings sheet */
  onMedia: (m: { video: HTMLVideoElement | null; quality: QualityApi | null }) => void
  /** A content warning is up: nothing plays until the viewer continues */
  hold: boolean
}) {
  const { data: ticket, isError } = usePlaybackTicket(episode.id, !locked && (active || preload))
  const saveProgress = useSaveProgress()
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [quality, setQuality] = useState<QualityApi | null>(null)
  useEffect(() => { if (active) onMedia({ video: videoEl, quality }) }, [active, videoEl, quality]) // eslint-disable-line react-hooks/exhaustive-deps
  // The chosen speed / quality follow the viewer from episode to episode
  useEffect(() => {
    if (!videoEl) return
    const apply = () => { videoEl.playbackRate = speed }
    apply()
    videoEl.addEventListener('loadedmetadata', apply)
    return () => videoEl.removeEventListener('loadedmetadata', apply)
  }, [videoEl, speed, quality])
  useEffect(() => {
    if (!quality) return
    if (qualityChoice === 'auto') quality.setAuto()
    else quality.setHeight(qualityChoice)
  }, [quality, qualityChoice])
  // While the episode plays the picture is left completely clean; the details
  // come back when the viewer pauses or touches the screen
  const [touched, setTouched] = useState(false)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poke = () => {
    setTouched(true)
    if (touchTimer.current) clearTimeout(touchTimer.current)
    touchTimer.current = setTimeout(() => setTouched(false), 3000)
  }
  useEffect(() => () => { if (touchTimer.current) clearTimeout(touchTimer.current) }, [])

  // Leaving a card resets it so coming back starts clean
  useEffect(() => {
    if (!active) { setPaused(false); setProgress(0); setDone(false) }
  }, [active])

  const poster = episode.thumbnail_url || series.thumbnail_url
  const playable = !locked && !!ticket && !isError
  const uiVisible = !playable || paused || done || touched
  useEffect(() => { if (active) onUiVisible(uiVisible) }, [active, uiVisible, onUiVisible])
  // Desktop: moving the mouse reveals the details, just like a touch does
  useEffect(() => { if (active && activity > 0) poke() }, [activity]) // eslint-disable-line react-hooks/exhaustive-deps
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
          paused={!active || paused || done || hold}
          quiet={!active}
          onMutedFallback={() => { onMutedChange(true); onSoundBlocked() }}
          onVideoRef={setVideoEl}
          onQuality={setQuality}
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

      {/* Tap to pause · press and hold the left / right side for 2x */}
      {playable && active && !done && (
        <TapHoldLayer video={videoEl} paused={paused} baseRate={speed} onToggle={() => (soundLocked ? onSoundUnlock() : setPaused(p => !p))} onTouch={poke} />
      )}

      {/* Episode chip + picker: only while paused, so it never sits on the picture */}
      {active && (paused || !playable) && (
        <button onClick={onOpenPicker} className="absolute top-3 left-1/2 -translate-x-1/2 z-[3] bg-black/45 backdrop-blur text-white text-xs font-bold px-3 py-2 rounded-full">
          EP {episode.episode_number} / {total} ▾
        </button>
      )}

      <div className={`absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/30 transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0'}`} />

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
      <div className={`absolute left-0 right-16 bottom-0 z-[2] p-4 pb-14 md:pb-6 pointer-events-none transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0'}`}>
        <h2 className="text-white font-bold text-lg leading-tight drop-shadow">{series.title}</h2>
        <p className="text-white/70 text-xs mt-0.5">Episode {episode.episode_number} of {series.total_episodes}{episode.title ? ` · ${episode.title}` : ''}</p>
        {episode.description && <p className="text-white/80 text-[13px] leading-snug mt-1.5 line-clamp-2">{episode.description}</p>}
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

      {playable && active && !done && (
        <ScrubBar video={videoEl} progress={progress} className="left-0 right-0 bottom-0" onTouch={poke} />
      )}
    </div>
  )
}

function WatchInner({ slug }: { slug: string }) {
  const router = useRouter()
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
  // Set when the browser blocked sound-on autoplay (e.g. a shared link opened with no tap first)
  const [soundLocked, setSoundLocked] = useState(false)
  // Series tagged "sensitive" in the admin ask before they play (remembered per series on this device)
  const [sensitiveOk, setSensitiveOk] = useState(false)
  const isSensitive = !!series?.tags?.some(t => ['sensitive', 'mature'].includes(t.trim().toLowerCase()))
  const gated = isSensitive && !sensitiveOk
  useEffect(() => {
    if (!series) return
    try { setSensitiveOk(localStorage.getItem(`dq.sensitiveOk.${series.slug}`) === '1') } catch { /* storage blocked */ }
  }, [series?.slug]) // eslint-disable-line react-hooks/exhaustive-deps
  const acceptSensitive = () => {
    setSensitiveOk(true)
    try { if (series) localStorage.setItem(`dq.sensitiveOk.${series.slug}`, '1') } catch { /* storage blocked */ }
  }
  const unlockSound = useCallback(() => { setMuted(false); setSoundLocked(false) }, [])
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [arrivedByAutoplay, setArrivedByAutoplay] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [settings, setSettings] = useState<null | 'main' | 'speed'>(null)
  const [speed, setSpeed] = useState(1)
  const [qualityChoice, setQualityChoice] = useState<'auto' | number>('auto')
  const [media, setMedia] = useState<{ video: HTMLVideoElement | null; quality: QualityApi | null }>({ video: null, quality: null })
  const [chromeVisible, setChromeVisible] = useState(true)
  const [activity, setActivity] = useState(0)
  const lastMove = useRef(0)
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return // phones already reveal on touch
    const now = Date.now()
    if (now - lastMove.current < 150) return
    lastMove.current = now
    setActivity(a => a + 1)
  }
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
  useEffect(() => {
    if (series && activeEpisode) track('episode_view', { series: series.slug, episode: activeEpisode.episode_number })
  }, [series?.slug, activeEpisode?.id]) // eslint-disable-line react-hooks/exhaustive-deps
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
    track('share_clicked', { series: series.slug })
    const url = `${window.location.origin}/watch/${series.slug}`
    try {
      if (navigator.share) await navigator.share({ title: series.title, text: `Watch ${series.title} on Dramatique`, url })
      else { await navigator.clipboard.writeText(url); showToast('Link copied 🔗', 'success') }
    } catch { /* share sheet dismissed */ }
  }

  return (
    <main className="fixed inset-0 z-[70] bg-black" onPointerMove={onPointerMove}>
      {/* On phones the episodes stop above a footer strip (membership + download) */}
      <div ref={scroller} onScroll={onScroll} className="absolute inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 overflow-y-scroll snap-y snap-mandatory scroll-hide overscroll-contain">
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
                soundLocked={soundLocked}
                onSoundBlocked={() => setSoundLocked(true)}
                onSoundUnlock={unlockSound}
                speed={speed}
                qualityChoice={qualityChoice}
                onMedia={setMedia}
                hold={gated}
                onFinished={() => {
                  if (i < episodes.length - 1) { autoplayNav.current = true; go(1) }
                }}
                onUnlockClick={() => setPaywallOpen(true)}
                isLast={i === episodes.length - 1}
                nextAvailable={ep.episode_number < series.total_episodes}
                onReplay={() => { /* local to the card */ }}
                onOpenPicker={() => setPickerOpen(true)}
                onUiVisible={setChromeVisible}
                activity={activity}
                total={series.total_episodes}
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
          <div className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 md:px-6 pointer-events-none bg-gradient-to-b from-black/50 to-transparent transition-opacity duration-300 ${chromeVisible ? 'opacity-100' : 'opacity-0 [&_a]:pointer-events-none [&_button]:pointer-events-none'}`}>
            <button
              onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
              aria-label="Back"
              className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center active:scale-90 transition-transform"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className="pointer-events-none flex items-center gap-2">
              <button onClick={() => { setSoundLocked(false); setMuted(m => !m) }} aria-label={muted ? 'Unmute' : 'Mute'} className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                {muted ? <VolumeX size={18} className="text-white" /> : <Volume2 size={18} className="text-white" />}
              </button>
              <button onClick={() => setSettings('speed')} aria-label="Playback speed" className="pointer-events-auto h-10 px-3 rounded-full bg-black/40 backdrop-blur flex items-center gap-1.5 text-white text-xs font-semibold">
                <Gauge size={16} /> {speed === 1 ? 'Speed' : speedLabel(speed)}
              </button>
              <button onClick={() => setSettings('main')} aria-label="Playback settings" className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                <MoreVertical size={20} className="text-white" />
              </button>
            </div>
          </div>

          {/* Shown whenever the browser forced muted playback — stays visible during clean playback */}
          {soundLocked && (
            <button
              onClick={unlockSound}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-[12] flex items-center gap-2 bg-black/65 backdrop-blur text-white text-xs font-semibold px-4 py-2.5 rounded-full border border-white/20 animate-fade-in active:scale-95 transition-transform"
            >
              <VolumeX size={16} /> Tap to turn sound on
            </button>
          )}

          {/* Side rail */}
          <div className={`absolute right-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+2.5rem)] md:bottom-10 md:right-[calc(50%-14rem)] z-10 flex flex-col items-center gap-4 transition-opacity duration-300 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button onClick={() => { track('save_toggled', { series: series.slug, saved: !saved }); toggleSave.mutate(series.id) }} aria-label={saved ? 'Remove from My List' : 'Add to My List'} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <span className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur ${saved ? 'bg-brand-red' : 'bg-black/45'}`}>
                {saved ? <Check size={20} className="text-white" /> : <Bookmark size={20} className="text-white" />}
              </span>
              <span className="text-white text-[10px] font-semibold drop-shadow">{saved ? 'Saved' : 'My List'}</span>
            </button>
            <button onClick={() => setPickerOpen(true)} aria-label="Episodes" className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur flex items-center justify-center"><ListBullets size={20} className="text-white" /></span>
              <span className="text-white text-[10px] font-semibold drop-shadow">Episodes</span>
            </button>
            <button onClick={share} aria-label="Share" className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur flex items-center justify-center"><Share2 size={20} className="text-white" /></span>
              <span className="text-white text-[10px] font-semibold drop-shadow">Share</span>
            </button>
          </div>

          {/* Footer strip (phones): join membership · download */}
          <div className="md:hidden absolute left-0 right-0 bottom-0 z-10 h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-black flex items-center justify-between px-4">
            <Link href="/vip" className="flex items-center gap-1.5 bg-brand-gold/90 text-black text-xs font-bold px-3.5 py-2 rounded-full active:scale-95 transition-transform">
              <Crown size={14} weight="fill" /> Join membership
            </Link>
            <Link href="/download" onClick={installOrContinue} className="flex items-center gap-1.5 text-white text-sm font-semibold active:scale-95 transition-transform">
              <Download size={16} /> Download
            </Link>
          </div>

          {/* Desktop up/down */}
          <div className={`hidden md:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col gap-3 z-10 transition-opacity duration-300 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button onClick={() => go(-1)} disabled={active === 0} aria-label="Previous episode" className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/10 flex items-center justify-center disabled:opacity-30">
              <ChevronUp size={20} className="text-white" />
            </button>
            <button onClick={() => go(1)} disabled={active === episodes.length - 1} aria-label="Next episode" className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/10 flex items-center justify-center disabled:opacity-30">
              <ChevronDown size={20} className="text-white" />
            </button>
          </div>
        </>
      )}

      {/* Content warning for series tagged "sensitive" */}
      {gated && series && (
        <div className="absolute inset-0 z-[40] bg-black/90 backdrop-blur-md flex items-center justify-center px-6 animate-fade-in" role="alertdialog" aria-label="Sensitive content warning">
          <div className="w-full max-w-xs bg-[#1c1c1e] rounded-2xl p-6 text-center">
            <AlertTriangle size={44} className="text-white mx-auto mb-4" />
            <h2 className="text-white font-bold text-lg mb-2">Sensitive Content Warning</h2>
            <p className="text-brand-subtle text-sm leading-relaxed mb-6">
              This content may contain scenes that some viewers may find disturbing. Continue watching?
            </p>
            <button onClick={acceptSensitive} className="w-full btn-primary py-3 mb-3">Continue</button>
            <button onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))} className="w-full bg-white/10 hover:bg-white/15 text-white font-semibold text-sm py-3 rounded-xl transition-colors">Go Back</button>
          </div>
        </div>
      )}

      {/* Playback Settings: quality · speed · picture-in-picture */}
      {settings && (
        <PlaybackSettings
          initial={settings}
          video={media.video}
          quality={media.quality}
          qualityChoice={qualityChoice}
          onQualityChoice={setQualityChoice}
          speed={speed}
          onSpeed={setSpeed}
          onClose={() => setSettings(null)}
        />
      )}

      {/* Episode sheet: Synopsis / Episodes */}
      {pickerOpen && series && (
        <EpisodeSheet series={series} episodes={episodes} active={active ?? 0} isLocked={isLocked} onJump={jumpTo} onClose={() => setPickerOpen(false)} />
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
