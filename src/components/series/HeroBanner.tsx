'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Play, BookmarkPlus, Check, ChevronLeft, ChevronRight, Star, Crown, Volume2, VolumeX } from '@/components/ui/icons'
import VideoPlayer from '@/components/player/VideoPlayer'
import { usePreviewEpisode, usePlaybackTicket, useSavedIds, useToggleSave } from '@/hooks'
import { canAutoPreview } from '@/lib/preview'
import { Series } from '@/types'

const SLIDE_MS = 7000
const PREVIEW_DELAY_MS = 2500

export default function HeroBanner({ series, loading = false }: { series: Series[]; loading?: boolean }) {
  const [current, setCurrent] = useState(0)
  const [previewing, setPreviewing] = useState(false)   // preview mounted
  const [previewShown, setPreviewShown] = useState(false) // first frame is playing
  const [muted, setMuted] = useState(true)
  const [allowPreview, setAllowPreview] = useState(false)
  const { data: savedIds = [] } = useSavedIds()
  const toggleSave = useToggleSave()

  const active = series[current] as Series | undefined
  const preview = usePreviewEpisode(active?.id)
  const { data: ticket } = usePlaybackTicket(preview?.id, allowPreview && !!preview)

  useEffect(() => { setAllowPreview(canAutoPreview()) }, [])

  // New slide: drop the old preview, then start this one after a beat
  useEffect(() => {
    setPreviewing(false)
    setPreviewShown(false)
    if (!allowPreview || !ticket) return
    const t = setTimeout(() => setPreviewing(true), PREVIEW_DELAY_MS)
    return () => clearTimeout(t)
  }, [current, ticket, allowPreview])

  // Rotate slides — but never cut a preview off mid-play; it advances when it ends
  useEffect(() => {
    if (series.length <= 1 || previewing) return
    const t = setTimeout(() => setCurrent(p => (p + 1) % series.length), SLIDE_MS)
    return () => clearTimeout(t)
  }, [series.length, current, previewing])

  if (loading) {
    return <div className="relative w-full h-[68vh] sm:h-[74vh] md:h-[86vh] skeleton" />
  }
  if (!series.length || !active) return null
  const saved = savedIds.includes(active.id)

  return (
    <div className="relative w-full h-[68vh] sm:h-[74vh] md:h-[86vh] overflow-hidden">
      {series.map((s, i) => (
        <div key={s.id} className={`absolute inset-0 transition-opacity duration-[1200ms] ease-smooth ${i === current ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`absolute inset-0 ${i === current ? 'animate-ken-burns' : ''}`}>
            <Image src={s.hero_url || s.thumbnail_url} alt={s.title} fill className="object-cover object-center" priority={i === 0} sizes="100vw" />
          </div>
        </div>
      ))}

      {/* Muted preview of episode 1 — full-bleed on phones, a 9:16 frame on desktop */}
      {previewing && ticket && (
        <div className={`absolute inset-0 md:inset-auto md:right-[8%] md:top-1/2 md:-translate-y-1/2 md:h-[62%] md:aspect-[9/16] md:rounded-2xl md:overflow-hidden md:ring-1 md:ring-white/15 md:shadow-2xl md:z-[1] transition-opacity duration-700 ${previewShown ? 'opacity-100' : 'opacity-0'}`}>
          <VideoPlayer
            key={ticket.episode_id}
            src={ticket.url}
            controls={false}
            muted={muted}
            fit="cover"
            quiet
            onPlaying={() => setPreviewShown(true)}
            onEnded={() => setCurrent(p => (p + 1) % series.length)}
          />
        </div>
      )}

      {/* Layered cinematic gradients — deeper, moodier */}
      <div className="absolute inset-0 cine-fade-r" />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-black/40 via-transparent to-transparent" />

      <div className="absolute inset-0 z-[2] flex items-end md:items-center pointer-events-none">
        <div className="px-5 md:px-8 pb-24 md:pb-0 max-w-2xl pointer-events-auto" key={active.id}>
          <div className="animate-slide-up">
            <div className="flex items-center gap-2.5 mb-4">
              {active.is_vip && (
                <span className="flex items-center gap-1 bg-brand-gold text-black text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">
                  <Crown size={10} className="fill-black" /> VIP
                </span>
              )}
              <span className="text-brand-red text-xs font-black uppercase tracking-[0.2em]">{active.genre}</span>
              {active.rating && (
                <span className="flex items-center gap-1 text-brand-gold text-xs font-bold">
                  <Star size={12} fill="currentColor" /> {active.rating}
                </span>
              )}
            </div>

            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl text-white leading-[0.92] mb-4 text-balance drop-shadow-2xl">
              {active.title}
            </h1>

            <p className="text-brand-text text-sm sm:text-base leading-relaxed mb-5 max-w-lg line-clamp-3">{active.synopsis}</p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 text-brand-subtle text-xs font-medium">
              <span>{active.total_episodes} Episodes</span>
              <span className="w-1 h-1 rounded-full bg-brand-muted" />
              <span className="text-green-400">{active.lock_from_episode > 1 ? `Free through Ep ${active.lock_from_episode - 1}` : 'Unlock with coins'}</span>
              <span className="w-1 h-1 rounded-full bg-brand-muted" />
              <span>{active.language}</span>
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/series/${active.slug}`} className="flex items-center gap-2 bg-brand-red hover:bg-brand-redHover text-white font-bold px-7 py-3.5 rounded-xl transition-all duration-200 text-sm shadow-glow-red active:scale-[0.97]">
                <Play size={17} fill="white" /> Watch Free
              </Link>
              <button
                onClick={() => toggleSave.mutate(active.id)}
                disabled={toggleSave.isPending}
                className={`flex items-center gap-2 border font-semibold px-6 py-3.5 rounded-xl transition-all duration-200 text-sm backdrop-blur-sm active:scale-[0.97] ${saved ? 'border-brand-red text-white bg-brand-red/15' : 'border-white/20 text-white bg-white/5 hover:bg-white/10 hover:border-white/30'}`}
              >
                {saved ? <><Check size={16} /> Saved</> : <><BookmarkPlus size={16} /> My List</>}
              </button>
              {previewShown && (
                <button
                  onClick={() => setMuted(m => !m)}
                  aria-label={muted ? 'Unmute preview' : 'Mute preview'}
                  className="w-12 h-12 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-sm flex items-center justify-center text-white transition-colors animate-fade-in"
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {series.length > 1 && (
        <div className="absolute bottom-12 md:bottom-24 right-5 md:right-8 flex items-center gap-2 z-10">
          <button onClick={() => setCurrent(p => (p - 1 + series.length) % series.length)} aria-label="Previous" className="w-8 h-8 rounded-full bg-black/40 backdrop-blur border border-white/10 hover:bg-brand-red hover:border-brand-red flex items-center justify-center transition-colors active:scale-90">
            <ChevronLeft size={15} className="text-white" />
          </button>
          <div className="flex gap-1.5">
            {series.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} aria-label={`Go to slide ${i + 1}`} className={`transition-all duration-300 rounded-full h-1.5 ${i === current ? 'w-6 bg-brand-red' : 'w-1.5 bg-white/30 hover:bg-white/50'}`} />
            ))}
          </div>
          <button onClick={() => setCurrent(p => (p + 1) % series.length)} aria-label="Next" className="w-8 h-8 rounded-full bg-black/40 backdrop-blur border border-white/10 hover:bg-brand-red hover:border-brand-red flex items-center justify-center transition-colors active:scale-90">
            <ChevronRight size={15} className="text-white" />
          </button>
        </div>
      )}
    </div>
  )
}
