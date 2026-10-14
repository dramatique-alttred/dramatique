'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import PaywallModal from '@/components/monetisation/PaywallModal'
import EmptyState from '@/components/ui/EmptyState'
import ReelPlayer from '@/components/player/ReelPlayer'
import { playbackApi, PlaybackInfo } from '@/lib/api'
import { ApiError } from '@/lib/apiClient'
import { useSeriesDetail, useRecommended, useSeriesAccess, useSavedIds, useToggleSave, useUnlockEpisode, useSaveProgress } from '@/hooks'
import { useCoinStore } from '@/store'
import { useUIStore } from '@/store/uiStore'
import type { Episode } from '@/types'
import { Bookmark, Share2, Lock, Play, ChevronRight, Crown, ArrowLeft, Check, Star, Maximize2 } from '@/components/ui/icons'

// Remembered per browser — a viewer who opts in once wants it every binge
const AUTO_UNLOCK_KEY = 'dq.autoUnlock'
function useAutoUnlock(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false)
  useEffect(() => { try { setOn(localStorage.getItem(AUTO_UNLOCK_KEY) === '1') } catch { /* storage blocked */ } }, [])
  const set = (v: boolean) => {
    setOn(v)
    try { localStorage.setItem(AUTO_UNLOCK_KEY, v ? '1' : '0') } catch { /* storage blocked */ }
  }
  return [on, set]
}

function EpisodeGrid({ total, isLocked, currentEp, coinCost, onSelect }: { total: number; isLocked: (ep: number) => boolean; currentEp: number; coinCost: number; onSelect: (ep: number) => void }) {
  const BATCH = 50
  const batches = Math.ceil(total / BATCH)
  const [batch, setBatch] = useState(0)
  const start = batch * BATCH
  const end = Math.min(start + BATCH, total)
  const eps = Array.from({ length: end - start }, (_, i) => start + i + 1)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: batches }, (_, i) => {
            const s = i * BATCH + 1; const e = Math.min((i + 1) * BATCH, total)
            return (
              <button key={i} onClick={() => setBatch(i)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${batch === i ? 'text-white bg-brand-red' : 'text-brand-subtle hover:text-white bg-brand-card'}`}>
                {s}-{e}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-brand-subtle">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/70" /> Free</span>
          <span className="flex items-center gap-1"><Lock size={9} className="text-brand-gold" /> {coinCost} coins</span>
        </div>
      </div>
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {eps.map(ep => {
          const locked = isLocked(ep)
          const active = currentEp === ep
          return (
            <button key={ep} onClick={() => onSelect(ep)} className={`aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-all border relative ${active ? 'bg-brand-red border-brand-red text-white shadow-glow-red' : locked ? 'bg-brand-card border-brand-border text-brand-muted hover:border-brand-gold/40' : 'bg-green-500/5 border-green-500/20 text-brand-text hover:border-green-500/40'}`}>
              {ep}
              {locked && !active && <Lock size={8} className="text-brand-gold/70 absolute top-1 right-1" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function SeriesDetailPage({ params }: { params: { slug: string } }) {
  const { data: series, isLoading, isError } = useSeriesDetail(params.slug)
  const { data: recommended = [] } = useRecommended(series?.id ?? '')
  const { data: access } = useSeriesAccess(series?.id)
  const { data: savedIds = [] } = useSavedIds()
  const toggleSave = useToggleSave()
  const unlock = useUnlockEpisode()
  const saveProgress = useSaveProgress()
  const balance = useCoinStore(s => s.balance)
  const showToast = useUIStore(st => st.showToast)

  const [currentEp, setCurrentEp] = useState(1)
  const [showFull, setShowFull] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [playback, setPlayback] = useState<PlaybackInfo | null>(null)
  const [notice, setNotice] = useState('')
  const [starting, setStarting] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const [autoUnlock, setAutoUnlock] = useAutoUnlock()

  // Jump to where the user left off — once, when their access info arrives
  const resumed = useRef(false)
  useEffect(() => {
    if (!resumed.current && access?.last_episode) {
      resumed.current = true
      setCurrentEp(access.last_episode)
    }
  }, [access?.last_episode])

  if (isError) {
    return (
      <div className="min-h-screen bg-brand-black pt-16">
        <EmptyState icon="🎬" title="Series not found" description="This drama doesn't exist or isn't available yet." actionLabel="Browse Series" actionHref="/categories" />
      </div>
    )
  }

  if (isLoading || !series) {
    return (
      <div className="min-h-screen bg-brand-black pt-16 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const episodeByNumber = new Map(series.episodes.map(e => [e.episode_number, e]))
  const unlockedIds = new Set(access?.unlocked_episode_ids ?? [])
  const isEpisodeLocked = (n: number) => {
    const ep = episodeByNumber.get(n)
    if (!ep) return true
    if (ep.access_type === 'FREE' || access?.is_vip || access?.can_watch_all) return false
    return !unlockedIds.has(ep.id)
  }
  const currentEpisode = episodeByNumber.get(currentEp)
  const isLocked = isEpisodeLocked(currentEp)
  const saved = savedIds.includes(series.id)

  // Ask the server for a stream URL — it decides access, not the UI
  const startPlayback = async (episodeId: string) => {
    setNotice('')
    setStarting(true)
    try {
      setPlayback(await playbackApi.get(episodeId))
    } catch (err) {
      setPlayback(null)
      if (err instanceof ApiError && err.status === 402) setPaywallOpen(true)
      else if (err instanceof ApiError && err.code === 'VIDEO_NOT_READY') setNotice('This episode is coming soon')
      else setNotice('Could not start playback. Try again.')
    } finally {
      setStarting(false)
    }
  }

  const handleEpSelect = (ep: number, fromEnded = false) => {
    setJustFinished(fromEnded)
    setCurrentEp(ep)
    setPlayback(null)
    setNotice('')
    const episode = episodeByNumber.get(ep)
    if (isEpisodeLocked(ep)) setPaywallOpen(true)
    else if (episode) startPlayback(episode.id)
  }

  const shareSeries = async () => {
    const url = `${window.location.origin}/watch/${series.slug}`
    try {
      if (navigator.share) await navigator.share({ title: series.title, text: `Watch ${series.title} on Dramatique`, url })
      else { await navigator.clipboard.writeText(url); showToast('Link copied 🔗', 'success') }
    } catch { /* share sheet dismissed */ }
  }

  const handlePlay = () => {
    if (!currentEpisode) return
    if (isLocked) setPaywallOpen(true)
    else startPlayback(currentEpisode.id)
  }

  const unlockAndPlay = (episode: Episode) => {
    const episodeId = episode.id
    unlock.mutate(
      { episodeId, coinCost: episode.coin_price, seriesId: series.id },
      // Unlocked → straight into the episode
      { onSuccess: () => { setPaywallOpen(false); startPlayback(episodeId) } },
    )
  }
  const handleUnlock = () => { if (currentEpisode) unlockAndPlay(currentEpisode) }

  // The binge loop: episode ends → mark it watched → next episode plays,
  // or the paywall appears if it's locked (the cliffhanger moment)
  const handleEnded = (duration: number) => {
    if (currentEpisode) saveProgress.mutate({ episodeId: currentEpisode.id, positionSeconds: duration, completed: true })
    const next = episodeByNumber.get(currentEp + 1)
    if (!next) return
    // Auto-unlock: the binge never stops while the viewer can afford it
    if (autoUnlock && isEpisodeLocked(next.episode_number) && next.access_type === 'COIN_LOCKED' && balance >= next.coin_price) {
      setCurrentEp(next.episode_number)
      setPlayback(null)
      unlockAndPlay(next)
      return
    }
    // Locked → the cliffhanger paywall; open → straight into the next episode
    handleEpSelect(next.episode_number, isEpisodeLocked(next.episode_number))
  }

  const isPlaying = !!playback && playback.episode_id === currentEpisode?.id
  const episodePoster = currentEpisode?.thumbnail_url || series.thumbnail_url
  const watchHref = `/watch/${series.slug}?ep=${currentEp}`

  return (
    <div className="min-h-screen bg-brand-black pt-16">
      <div className="max-w-[1400px] mx-auto px-0 md:px-8">

        {/* BREADCRUMB */}
        <div className="hidden md:flex items-center gap-2 text-xs text-brand-subtle py-4">
          <Link href="/" className="hover:text-white transition-colors">Home</Link><ChevronRight size={12} />
          <Link href="/categories" className="hover:text-white transition-colors">{series.genre}</Link><ChevronRight size={12} />
          <span className="text-white font-medium">Episode {currentEp}</span>
        </div>

        <div className="flex flex-col md:flex-row gap-0 md:gap-8">

          {/* LEFT: PLAYER — the same reel-style surface as the Shorts feed */}
          <div className="w-full md:w-[42%] lg:w-[38%] flex-shrink-0">
            <div className="md:hidden flex items-center gap-3 px-4 py-3">
              <Link href="/" className="w-9 h-9 rounded-full bg-brand-card flex items-center justify-center active:scale-90 transition-transform">
                <ArrowLeft size={18} className="text-white" />
              </Link>
              <span className="text-brand-text text-sm truncate">{series.title}</span>
            </div>

            <div className="relative bg-black mx-auto md:rounded-3xl overflow-hidden md:ring-1 md:ring-white/10 md:shadow-2xl" style={{ aspectRatio: '9/16', maxHeight: '82vh' }}>
              {isPlaying ? (
                <ReelPlayer
                  key={playback.episode_id}
                  src={playback.url}
                  poster={episodePoster}
                  startAt={playback.resume_position_seconds}
                  episodeLabel={`EP ${currentEp} / ${series.total_episodes}`}
                  seriesTitle={series.title}
                  episodeTitle={currentEpisode?.title}
                  description={currentEpisode?.description}
                  fullscreenHref={watchHref}
                  onProgress={pos => saveProgress.mutate({ episodeId: playback.episode_id, positionSeconds: pos })}
                  onEnded={handleEnded}
                  onPrev={episodeByNumber.has(currentEp - 1) ? () => handleEpSelect(currentEp - 1) : undefined}
                  onNext={episodeByNumber.has(currentEp + 1) ? () => handleEpSelect(currentEp + 1) : undefined}
                />
              ) : (
                <>
                  <Image src={episodePoster} alt={series.title} fill sizes="(min-width: 768px) 420px, 100vw" className="object-cover" priority />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40" />

                  {!isLocked ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <button onClick={handlePlay} disabled={starting} aria-label={`Play episode ${currentEp}`} className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center hover:bg-brand-red hover:border-brand-red transition-all active:scale-90 disabled:opacity-60">
                        {starting ? <span className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Play size={32} fill="white" className="text-white ml-1" />}
                      </button>
                      {notice && <p className="text-white text-sm font-semibold bg-black/60 px-3 py-1.5 rounded-full">{notice}</p>}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md px-6">
                      <div className="w-14 h-14 rounded-full bg-brand-gold/15 flex items-center justify-center mb-3">
                        <Lock size={26} className="text-brand-gold" />
                      </div>
                      <p className="text-white font-bold text-lg mb-1 text-center">Episode {currentEp} Locked</p>
                      <p className="text-brand-subtle text-sm mb-5 text-center">Unlock to keep watching</p>
                      <div className="flex flex-col gap-2 w-full max-w-[220px]">
                        <button onClick={() => setPaywallOpen(true)} className="btn-primary flex items-center justify-center gap-2">🪙 Use {currentEpisode?.coin_price ?? series.coin_cost_per_episode} Coins</button>
                      </div>
                    </div>
                  )}

                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <span className="bg-black/50 backdrop-blur text-white text-xs font-bold px-2.5 py-1 rounded-full">EP {currentEp} / {series.total_episodes}</span>
                    {series.is_vip && (
                      <span className="flex items-center gap-1 bg-brand-gold text-black text-[10px] font-black px-2 py-1 rounded uppercase">
                        <Crown size={10} className="fill-black" /> VIP
                      </span>
                    )}
                  </div>
                  <div className="absolute left-0 right-0 bottom-0 p-4 pb-5 pointer-events-none">
                    <h3 className="text-white font-bold text-base leading-tight drop-shadow">{series.title}</h3>
                    {currentEpisode?.title && <p className="text-white/70 text-xs mt-0.5">{currentEpisode.title}</p>}
                    {currentEpisode?.description && <p className="text-white/80 text-[13px] leading-snug mt-1.5 line-clamp-2">{currentEpisode.description}</p>}
                  </div>
                </>
              )}
            </div>

            <Link href={watchHref} className="hidden md:flex items-center justify-center gap-2 mt-3 text-brand-subtle hover:text-white text-xs font-semibold transition-colors">
              <Maximize2 size={14} /> Watch in full screen
            </Link>
          </div>

          {/* RIGHT: INFO — one simple column that scrolls with the page */}
          <div className="flex-1 min-w-0 px-4 md:px-0 py-5 md:py-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-brand-red text-xs font-black uppercase tracking-widest">{series.genre}</span>
              {series.rating ? <span className="flex items-center gap-1 text-brand-gold text-xs font-bold"><Star size={11} fill="currentColor" />{series.rating}</span> : null}
            </div>
            <h1 className="text-white font-bold text-3xl leading-tight mb-2">{series.title}</h1>
            <p className="text-brand-subtle text-sm mb-4">
              {series.total_episodes} episodes · <span className="text-green-400">Free through Ep {series.lock_from_episode - 1}</span> · {series.language}
            </p>

            <p className="text-brand-text text-[15px] leading-relaxed mb-6">
              {showFull ? series.synopsis : `${series.synopsis.slice(0, 160)}${series.synopsis.length > 160 ? '…' : ''}`}
              {series.synopsis.length > 160 && (
                <button onClick={() => setShowFull(!showFull)} className="text-brand-red ml-1 font-semibold hover:text-red-400">
                  {showFull ? 'Less' : 'More'}
                </button>
              )}
            </p>

            {/* One main action, two quiet ones */}
            <div className="flex items-center gap-3 mb-8">
              <Link href={`/watch/${series.slug}?ep=${access?.last_episode ?? 1}`} className="flex-1 btn-primary py-3 flex items-center justify-center gap-2">
                <Play size={16} fill="white" /> {access?.last_episode ? `Resume Episode ${access.last_episode}` : 'Start Watching — Free'}
              </Link>
              <button
                onClick={() => toggleSave.mutate(series.id)}
                disabled={toggleSave.isPending}
                aria-label={saved ? 'Remove from My List' : 'Add to My List'}
                className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-colors active:scale-95 ${saved ? 'bg-brand-red/15 border-brand-red text-brand-red' : 'border-brand-border text-brand-subtle hover:text-white hover:border-brand-muted'}`}
              >
                {saved ? <Check size={20} /> : <Bookmark size={20} />}
              </button>
              <button
                onClick={shareSeries}
                aria-label="Share"
                className="w-12 h-12 rounded-xl border border-brand-border text-brand-subtle hover:text-white hover:border-brand-muted flex items-center justify-center transition-colors active:scale-95"
              >
                <Share2 size={20} />
              </button>
            </div>

            <h2 className="text-white font-bold text-base mb-3">Episodes</h2>
            <EpisodeGrid total={series.total_episodes} isLocked={isEpisodeLocked} currentEp={currentEp} coinCost={series.coin_cost_per_episode} onSelect={handleEpSelect} />

            {currentEpisode && (currentEpisode.title || currentEpisode.description) && (
              <div className="mt-6">
                <p className="text-white font-semibold text-sm">Episode {currentEp}{currentEpisode.title ? ` · ${currentEpisode.title}` : ''}</p>
                {currentEpisode.description && <p className="text-brand-subtle text-sm leading-relaxed mt-1">{currentEpisode.description}</p>}
              </div>
            )}
          </div>
        </div>

        <PaywallModal
          isOpen={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          episodeNumber={currentEp}
          coinCost={currentEpisode?.coin_price ?? series.coin_cost_per_episode}
          seriesTitle={series.title}
          posterUrl={currentEpisode?.thumbnail_url || series.thumbnail_url}
          episodeTitle={currentEpisode?.title}
          justFinished={justFinished}
          autoUnlock={autoUnlock}
          onAutoUnlockChange={setAutoUnlock}
          vipOnly={currentEpisode?.access_type === 'VIP_ONLY'}
          onUnlock={handleUnlock}
          unlocking={unlock.isPending}
        />

        {/* RECOMMENDATIONS */}
        <div className="px-4 md:px-0 py-10">
          <h2 className="text-white font-bold text-lg mb-4">You May Also Like</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
            {recommended.map(s => (
              <Link key={s.id} href={`/watch/${s.slug}`} className="group">
                <div className="aspect-[2/3] relative rounded-xl overflow-hidden mb-2 ring-1 ring-white/5">
                  <Image src={s.thumbnail_url} alt={s.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="200px" />
                  <div className="absolute inset-0 cine-fade opacity-70" />
                </div>
                <p className="text-brand-bright text-xs font-semibold truncate group-hover:text-white transition-colors">{s.title}</p>
                <p className="text-brand-subtle text-[10px] mt-0.5">{s.genre}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
