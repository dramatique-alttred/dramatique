'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import VideoPlayer from '@/components/player/VideoPlayer'
import { ScrubBar, TapHoldLayer } from '@/components/player/ReelControls'
import { Volume2, VolumeX, ChevronUp, ChevronDown, Maximize2 } from '@/components/ui/icons'

/**
 * The series page's player, dressed like the swipe feed: edge-to-edge picture,
 * no native browser controls, tap to pause, a thin progress line, and episodes
 * that roll straight into each other. The full-screen reel lives at /watch.
 */
export default function ReelPlayer({
  src, poster, startAt = 0, episodeLabel, seriesTitle, episodeTitle, description,
  fullscreenHref, onProgress, onEnded, onPrev, onNext,
}: {
  src: string
  poster?: string
  startAt?: number
  episodeLabel: string
  seriesTitle: string
  episodeTitle?: string
  description?: string | null
  fullscreenHref: string
  onProgress: (positionSeconds: number) => void
  onEnded: (durationSeconds: number) => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  // Clean picture while playing; details return on pause or touch
  const [touched, setTouched] = useState(false)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poke = () => {
    setTouched(true)
    if (touchTimer.current) clearTimeout(touchTimer.current)
    touchTimer.current = setTimeout(() => setTouched(false), 3000)
  }
  useEffect(() => () => { if (touchTimer.current) clearTimeout(touchTimer.current) }, [])
  const uiVisible = paused || touched
  const fade = `transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`

  // A different episode starts fresh
  useEffect(() => { setPaused(false); setProgress(0) }, [src])

  // Space / K pause, M mutes — same keys as the swipe feed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))) return
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); setPaused(p => !p) }
      if (e.key === 'm') setMuted(m => !m)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="absolute inset-0 bg-black">
      <VideoPlayer
        src={src}
        poster={poster}
        startAt={startAt}
        controls={false}
        fit="cover"
        muted={muted}
        paused={paused}
        onMutedFallback={() => setMuted(true)}
        onVideoRef={setVideoEl}
        onTick={(pos, dur) => setProgress(pos / dur)}
        onProgress={pos => onProgress(pos)}
        onEnded={onEnded}
      />

      {/* Tap to pause · press and hold the left / right side for 2x */}
      <TapHoldLayer video={videoEl} paused={paused} onToggle={() => setPaused(p => !p)} onTouch={poke} />

      <div className={`absolute inset-0 pointer-events-none bg-gradient-to-t from-black/85 via-transparent to-black/35 ${fade}`} />

      {/* Top: episode chip, sound, full screen */}
      <div className={`absolute top-3 left-3 right-3 z-[2] flex items-center justify-between pointer-events-none transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0'}`}>
        {/* Hidden while playing so nothing sits on the picture */}
        <span className="bg-black/50 backdrop-blur text-white text-xs font-bold px-2.5 py-1 rounded-full">{episodeLabel}</span>
        <div className={`flex items-center gap-2 ${uiVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <button onClick={() => setMuted(m => !m)} aria-label={muted ? 'Unmute' : 'Mute'} className="w-9 h-9 rounded-full bg-black/45 backdrop-blur flex items-center justify-center">
            {muted ? <VolumeX size={16} className="text-white" /> : <Volume2 size={16} className="text-white" />}
          </button>
          <Link href={fullscreenHref} aria-label="Watch full screen" className="w-9 h-9 rounded-full bg-black/45 backdrop-blur flex items-center justify-center">
            <Maximize2 size={16} className="text-white" />
          </Link>
        </div>
      </div>

      {/* Prev / next episode */}
      {(onPrev || onNext) && (
        <div className={`absolute right-3 bottom-8 z-[2] flex flex-col gap-2 ${fade}`}>
          {onPrev && (
            <button onClick={onPrev} aria-label="Previous episode" className="w-10 h-10 rounded-full bg-black/45 backdrop-blur flex items-center justify-center active:scale-90 transition-transform">
              <ChevronUp size={18} className="text-white" />
            </button>
          )}
          {onNext && (
            <button onClick={onNext} aria-label="Next episode" className="w-10 h-10 rounded-full bg-black/45 backdrop-blur flex items-center justify-center active:scale-90 transition-transform">
              <ChevronDown size={18} className="text-white" />
            </button>
          )}
        </div>
      )}

      {/* Story line */}
      <div className={`absolute left-0 right-14 bottom-0 z-[2] p-4 pb-7 pointer-events-none transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0'}`}>
        <h3 className="text-white font-bold text-base leading-tight drop-shadow">{seriesTitle}</h3>
        {episodeTitle && <p className="text-white/70 text-xs mt-0.5">{episodeTitle}</p>}
        {description && <p className="text-white/80 text-[13px] leading-snug mt-1.5 line-clamp-2">{description}</p>}
      </div>

      {/* Episode progress — touch and drag to scrub */}
      <ScrubBar video={videoEl} progress={progress} className="left-0 right-0 bottom-0" onTouch={poke} />
    </div>
  )
}
