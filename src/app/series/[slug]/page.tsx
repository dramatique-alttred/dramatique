'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import PaywallModal from '@/components/monetisation/PaywallModal'
import EmptyState from '@/components/ui/EmptyState'
import VideoPlayer from '@/components/player/VideoPlayer'
import { playbackApi, PlaybackInfo } from '@/lib/api'
import { ApiError } from '@/lib/apiClient'
import { useSeriesDetail, useRecommended, useSeriesAccess, useSavedIds, useToggleSave, useUnlockEpisode, useSaveProgress } from '@/hooks'
import { Heart, Bookmark, Share2, Lock, Play, ChevronRight, Crown, ArrowLeft, Check, Star } from 'lucide-react'

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
        <button onClick={() => onSelect(0)} className={`aspect-square rounded-lg text-[10px] font-bold flex items-center justify-center transition-all border ${currentEp === 0 ? 'bg-brand-red border-brand-red text-white' : 'bg-brand-card border-brand-border text-brand-subtle hover:text-white hover:border-brand-muted'}`}>
          Trailer
        </button>
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

  const [currentEp, setCurrentEp] = useState(1)
  const [liked, setLiked] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [playback, setPlayback] = useState<PlaybackInfo | null>(null)
  const [notice, setNotice] = useState('')
  const [starting, setStarting] = useState(false)

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
    if (n === 0) return false // trailer
    const ep = episodeByNumber.get(n)
    if (!ep) return true
    if (ep.access_type === 'FREE' || access?.is_vip) return false
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

  const handleEpSelect = (ep: number) => {
    setCurrentEp(ep)
    setPlayback(null)
    setNotice('')
    const episode = episodeByNumber.get(ep)
    if (isEpisodeLocked(ep)) setPaywallOpen(true)
    else if (episode) startPlayback(episode.id)
  }

  const handlePlay = () => {
    if (!currentEpisode) return
    if (isLocked) setPaywallOpen(true)
    else startPlayback(currentEpisode.id)
  }

  const handleUnlock = () => {
    if (!currentEpisode) return
    const episodeId = currentEpisode.id
    unlock.mutate(
      { episodeId, coinCost: currentEpisode.coin_price, seriesId: series.id },
      // Unlocked → straight into the episode
      { onSuccess: () => { setPaywallOpen(false); startPlayback(episodeId) } },
    )
  }

  // The binge loop: episode ends → mark it watched → next episode plays,
  // or the paywall appears if it's locked (the cliffhanger moment)
  const handleEnded = (duration: number) => {
    if (currentEpisode) saveProgress.mutate({ episodeId: currentEpisode.id, positionSeconds: duration, completed: true })
    if (episodeByNumber.has(currentEp + 1)) handleEpSelect(currentEp + 1)
  }

  const isPlaying = !!playback && playback.episode_id === currentEpisode?.id

  return (
    <div className="min-h-screen bg-brand-black pt-16">
      <div className="max-w-[1400px] mx-auto px-0 md:px-8">

        {/* BREADCRUMB */}
        <div className="hidden md:flex items-center gap-2 text-xs text-brand-subtle py-4">
          <Link href="/" className="hover:text-white transition-colors">Home</Link><ChevronRight size={12} />
          <Link href="/categories" className="hover:text-white transition-colors">{series.genre}</Link><ChevronRight size={12} />
          <span className="text-white font-medium">{currentEp === 0 ? 'Trailer' : `Episode ${currentEp}`}</span>
        </div>

        <div className="flex flex-col md:flex-row gap-0 md:gap-8">

          {/* LEFT: PLAYER */}
          <div className="w-full md:w-[45%] lg:w-[46%] flex-shrink-0">
            <div className="md:hidden flex items-center gap-3 px-4 py-3">
              <Link href="/" className="w-9 h-9 rounded-full bg-brand-card flex items-center justify-center active:scale-90 transition-transform">
                <ArrowLeft size={18} className="text-white" />
              </Link>
              <span className="text-brand-text text-sm truncate">{series.title}</span>
            </div>

            <div className="relative bg-black md:rounded-2xl md:overflow-hidden" style={{ aspectRatio: '9/16', maxHeight: '85vh' }}>
              {isPlaying ? (
                <VideoPlayer
                  key={playback.episode_id}
                  src={playback.url}
                  poster={series.thumbnail_url}
                  startAt={playback.resume_position_seconds}
                  onProgress={pos => saveProgress.mutate({ episodeId: playback.episode_id, positionSeconds: pos })}
                  onEnded={handleEnded}
                />
              ) : (
                <>
                  <Image src={series.thumbnail_url} alt={series.title} fill className="object-cover" priority />
                  <div className="absolute inset-0 bg-black/25" />

                  {!isLocked ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <button onClick={handlePlay} disabled={starting} aria-label={`Play episode ${currentEp}`} className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-brand-red hover:border-brand-red transition-all active:scale-90 disabled:opacity-60">
                        {starting ? <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Play size={28} fill="white" className="text-white ml-1" />}
                      </button>
                      {notice && <p className="text-white text-sm font-semibold bg-black/60 px-3 py-1.5 rounded-full">{notice}</p>}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md px-6">
                      <div className="w-14 h-14 rounded-full bg-brand-gold/15 flex items-center justify-center mb-3">
                        <Lock size={26} className="text-brand-gold" />
                      </div>
                      <p className="text-white font-bold text-lg mb-1 text-center">Episode {currentEp} Locked</p>
                      <p className="text-brand-subtle text-sm mb-5 text-center">Unlock to keep watching</p>
                      <div className="flex flex-col gap-2 w-full max-w-[220px]">
                        <button onClick={() => setPaywallOpen(true)} className="btn-primary flex items-center justify-center gap-2">🪙 Use {currentEpisode?.coin_price ?? series.coin_cost_per_episode} Coins</button>
                        <button onClick={() => setPaywallOpen(true)} className="btn-outline flex items-center justify-center gap-2">📺 Watch 2 Ads Free</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {currentEp === 0 ? 'Trailer' : `EP ${currentEp}`} / {series.total_episodes}
              </div>
              {series.is_vip && (
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-brand-gold text-black text-[10px] font-black px-2 py-1 rounded uppercase">
                  <Crown size={10} className="fill-black" /> VIP
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: INFO */}
          <div className="flex-1 px-4 md:px-0 py-5 md:py-2 overflow-y-auto scroll-hide" style={{ maxHeight: '85vh' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-brand-red text-xs font-black uppercase tracking-widest">{series.genre}</span>
              {series.rating && <span className="flex items-center gap-1 text-brand-gold text-xs font-bold"><Star size={11} fill="currentColor" />{series.rating}</span>}
            </div>
            <h1 className="text-white font-bold text-2xl leading-tight mb-1">{series.title}</h1>
            <div className="flex items-center gap-2 text-brand-subtle text-xs mb-4">
              <span>{series.total_episodes} Episodes</span>
              <span className="w-1 h-1 rounded-full bg-brand-muted" />
              <span className="text-green-400">Free through Ep {series.lock_from_episode - 1}</span>
              <span className="w-1 h-1 rounded-full bg-brand-muted" />
              <span>{series.language}</span>
            </div>

            <p className="text-brand-text text-sm leading-relaxed mb-4">
              {showFull ? series.synopsis : `${series.synopsis.slice(0, 120)}${series.synopsis.length > 120 ? '…' : ''}`}
              {series.synopsis.length > 120 && (
                <button onClick={() => setShowFull(!showFull)} className="text-brand-red ml-1 font-semibold hover:text-red-400">
                  {showFull ? 'Less' : 'More'}
                </button>
              )}
            </p>

            <div className="flex flex-wrap gap-2 mb-5">
              {(series.tags || [series.genre, series.language]).map(tag => (
                <span key={tag} className="text-xs text-brand-text border border-brand-border px-3 py-1 rounded-full hover:border-brand-muted cursor-pointer transition-colors">{tag}</span>
              ))}
            </div>

            {/* Primary CTA */}
            <button onClick={() => handleEpSelect(access?.last_episode ?? 1)} className="w-full btn-primary py-3 flex items-center justify-center gap-2 mb-4">
              <Play size={16} fill="white" /> {access?.last_episode ? `Resume Episode ${access.last_episode}` : 'Start Watching — Free'}
            </button>

            <div className="border-t border-brand-border mb-4" />

            <div className="flex items-center justify-around mb-5">
              <button onClick={() => setLiked(!liked)} className="flex flex-col items-center gap-1.5 group active:scale-90 transition-transform">
                <Heart size={22} className={liked ? 'text-brand-red fill-brand-red' : 'text-brand-subtle group-hover:text-white'} />
                <span className={`text-xs font-semibold ${liked ? 'text-brand-red' : 'text-brand-subtle'}`}>39.5k</span>
              </button>
              <div className="w-px h-8 bg-brand-border" />
              <button onClick={() => toggleSave.mutate(series.id)} disabled={toggleSave.isPending} className="flex flex-col items-center gap-1.5 group active:scale-90 transition-transform">
                {saved ? <Check size={22} className="text-brand-red" /> : <Bookmark size={22} className="text-brand-subtle group-hover:text-white" />}
                <span className={`text-xs font-semibold ${saved ? 'text-brand-red' : 'text-brand-subtle'}`}>{saved ? 'Saved' : 'My List'}</span>
              </button>
              <div className="w-px h-8 bg-brand-border" />
              <button className="flex flex-col items-center gap-1.5 group active:scale-90 transition-transform">
                <Share2 size={22} className="text-brand-subtle group-hover:text-white" />
                <span className="text-xs font-semibold text-brand-subtle group-hover:text-white">Share</span>
              </button>
            </div>

            <div className="border-t border-brand-border mb-5" />

            <h3 className="text-white font-bold text-sm mb-3">Episodes</h3>
            <EpisodeGrid total={series.total_episodes} isLocked={isEpisodeLocked} currentEp={currentEp} coinCost={series.coin_cost_per_episode} onSelect={handleEpSelect} />
          </div>
        </div>

        <PaywallModal
          isOpen={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          episodeNumber={currentEp}
          coinCost={currentEpisode?.coin_price ?? series.coin_cost_per_episode}
          seriesTitle={series.title}
          vipOnly={currentEpisode?.access_type === 'VIP_ONLY'}
          onUnlock={handleUnlock}
          unlocking={unlock.isPending}
        />

        {/* RECOMMENDATIONS */}
        <div className="px-4 md:px-0 py-10">
          <h2 className="text-white font-bold text-lg mb-4">You May Also Like</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
            {recommended.map(s => (
              <Link key={s.id} href={`/series/${s.slug}`} className="group">
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
