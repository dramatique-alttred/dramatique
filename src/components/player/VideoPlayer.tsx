'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'

interface VideoPlayerProps {
  src: string                 // HLS master playlist
  poster?: string
  startAt?: number            // resume position (seconds)
  autoPlay?: boolean
  /** Called about every 10 s while playing, and on pause */
  onProgress?: (positionSeconds: number, durationSeconds: number) => void
  onEnded?: (durationSeconds: number) => void
  className?: string
}

const REPORT_EVERY_MS = 10_000

/**
 * Adaptive HLS player (Shaka Player). Picks the best quality the viewer's
 * connection can sustain and switches every few seconds — 360p on weak 4G,
 * 1080p on Wi-Fi. Shaka is browser-only, so it's loaded on demand.
 */
export default function VideoPlayer({ src, poster, startAt = 0, autoPlay = true, onProgress, onEnded, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Keep the latest callbacks without re-creating the player on every render
  const onProgressRef = useRef(onProgress)
  const onEndedRef = useRef(onEnded)
  onProgressRef.current = onProgress
  onEndedRef.current = onEnded

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
        if (autoPlay) video.play().catch(() => { /* autoplay blocked — user taps play */ })
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

  // Progress reporting for Continue Watching / resume
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let lastReport = 0
    const report = () => {
      if (video.duration && Number.isFinite(video.duration)) onProgressRef.current?.(video.currentTime, video.duration)
    }
    const onTime = () => {
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
    <div className={`relative w-full h-full bg-black ${className}`}>
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        controls
        controlsList="nodownload"
        className="absolute inset-0 w-full h-full object-contain"
      />
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 size={36} className="text-white/80 animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 px-6 text-center">
          <AlertTriangle size={28} className="text-brand-gold" />
          <p className="text-white text-sm font-semibold">{error}</p>
          <p className="text-brand-subtle text-xs">Check your connection and try again.</p>
        </div>
      )}
    </div>
  )
}
