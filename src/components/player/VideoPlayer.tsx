'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle } from '@/components/ui/icons'

interface VideoPlayerProps {
  src: string                 // HLS master playlist
  poster?: string
  startAt?: number            // resume position (seconds)
  autoPlay?: boolean
  /** Called about every 10 s while playing, and on pause */
  onProgress?: (positionSeconds: number, durationSeconds: number) => void
  onEnded?: (durationSeconds: number) => void
  className?: string
  /** Native browser controls (default on). The swipe feed draws its own. */
  controls?: boolean
  muted?: boolean
  paused?: boolean
  /** Every timeupdate — for custom progress bars */
  onTick?: (positionSeconds: number, durationSeconds: number) => void
  /** Browser refused autoplay with sound, so playback fell back to muted */
  onMutedFallback?: () => void
  /** 'cover' fills the box (previews); 'contain' letterboxes (default) */
  fit?: 'contain' | 'cover'
  /** Hide the loading spinner (ambient previews fade in instead) */
  quiet?: boolean
  onPlaying?: () => void
}

const REPORT_EVERY_MS = 10_000

/**
 * Adaptive HLS player (Shaka Player). Picks the best quality the viewer's
 * connection can sustain and switches every few seconds — 360p on weak 4G,
 * 1080p on Wi-Fi. Shaka is browser-only, so it's loaded on demand.
 */
export default function VideoPlayer({
  src, poster, startAt = 0, autoPlay = true, onProgress, onEnded, className = '',
  controls = true, muted = false, paused = false, onTick, onMutedFallback,
  fit = 'contain', quiet = false, onPlaying,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Keep the latest callbacks without re-creating the player on every render
  const onProgressRef = useRef(onProgress)
  const onEndedRef = useRef(onEnded)
  const onTickRef = useRef(onTick)
  const onMutedFallbackRef = useRef(onMutedFallback)
  const pausedRef = useRef(paused)
  onProgressRef.current = onProgress
  onEndedRef.current = onEnded
  onTickRef.current = onTick
  onMutedFallbackRef.current = onMutedFallback
  pausedRef.current = paused

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let player: { destroy(): Promise<void> } | null = null
    let cancelled = false
    setLoading(true)
    setError('')

    ;(async () => {
      try {
        const shaka = (await import('shaka-player')).default
        if (cancelled) return
        shaka.polyfill.installAll()
        if (!shaka.Player.isBrowserSupported()) {
          // Very old browsers: fall back to native HLS (e.g. older Safari)
          video.src = src
        } else {
          const p = new shaka.Player()
          player = p
          await p.attach(video)
          p.configure({ streaming: { bufferingGoal: 20, rebufferingGoal: 2 } })
          p.addEventListener('error', (e: any) => setError(e?.detail?.message || 'Playback error'))
          await p.load(src, startAt > 0 ? startAt : null)
        }
        if (cancelled) return
        setLoading(false)
        if (autoPlay && !pausedRef.current) {
          video.play().catch(() => {
            // Sound-on autoplay needs a prior tap; muted autoplay is always allowed
            if (video.muted) return
            video.muted = true
            onMutedFallbackRef.current?.()
            video.play().catch(() => { /* still blocked — user taps play */ })
          })
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoading(false)
          setError(err?.code ? `Could not load video (code ${err.code})` : 'Could not load video')
        }
      }
    })()

    return () => {
      cancelled = true
      player?.destroy().catch(() => {})
    }
  }, [src, startAt, autoPlay])

  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted }, [muted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || loading) return
    if (paused) video.pause()
    else video.play().catch(() => {})
  }, [paused, loading])

  // Browsers won't start video in a background tab. Ambient players (feed,
  // previews) pick up when the viewer comes back; the full player waits for them.
  useEffect(() => {
    if (controls) return
    const onVisible = () => {
      const video = videoRef.current
      if (document.visibilityState === 'visible' && video?.paused && !video.ended && !pausedRef.current) video.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [controls])

  // Keyboard shortcuts for the full player (the swipe feed has its own)
  useEffect(() => {
    if (!controls) return
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current
      const t = e.target as HTMLElement | null
      if (!video || e.metaKey || e.ctrlKey || e.altKey) return
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))) return
      switch (e.key) {
        case ' ': case 'k':
          e.preventDefault()
          if (video.paused) video.play().catch(() => {}); else video.pause()
          break
        case 'ArrowRight': e.preventDefault(); video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); break
        case 'ArrowLeft': e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); break
        case 'm': video.muted = !video.muted; break
        case 'f':
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
          else (video.parentElement ?? video).requestFullscreen?.().catch(() => {})
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controls])

  // Progress reporting for Continue Watching / resume
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let lastReport = 0
    const report = () => {
      if (video.duration && Number.isFinite(video.duration)) onProgressRef.current?.(video.currentTime, video.duration)
    }
    const onTime = () => {
      if (video.duration && Number.isFinite(video.duration)) onTickRef.current?.(video.currentTime, video.duration)
      const now = Date.now()
      if (now - lastReport >= REPORT_EVERY_MS) { lastReport = now; report() }
    }
    const onEnd = () => onEndedRef.current?.(video.duration || 0)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('pause', report)
    video.addEventListener('ended', onEnd)
    return () => {
      report() // leaving the episode counts as a save point
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('pause', report)
      video.removeEventListener('ended', onEnd)
    }
  }, [src])

  return (
    <div className={`relative w-full h-full ${fit === 'contain' ? 'bg-black' : ''} ${className}`}>
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        controls={controls}
        muted={muted}
        controlsList="nodownload"
        onPlaying={onPlaying}
        className={`absolute inset-0 w-full h-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
      />
      {loading && !error && !quiet && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 size={36} className="text-white/80 animate-spin" />
        </div>
      )}
      {error && !quiet && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 px-6 text-center">
          <AlertTriangle size={28} className="text-brand-gold" />
          <p className="text-white text-sm font-semibold">{error}</p>
          <p className="text-brand-subtle text-xs">Check your connection and try again.</p>
        </div>
      )}
    </div>
  )
}
