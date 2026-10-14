'use client'

import { useEffect, useRef, useState } from 'react'
import { Play } from '@/components/ui/icons'

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

/**
 * The red progress line, made draggable. Touch (or click) and drag anywhere on
 * it to scrub; a generous invisible hit area keeps it easy to grab on a phone
 * while the visible line stays thin.
 */
export function ScrubBar({
  video, progress, className = '', onTouch,
}: {
  video: HTMLVideoElement | null
  /** 0–1, from the player's timeupdate */
  progress: number
  /** Positioning classes for the bar (e.g. `left-0 right-0 bottom-0`) */
  className?: string
  /** Called when the bar is touched, so the player can reveal its overlay */
  onTouch?: () => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const [dragFrac, setDragFrac] = useState<number | null>(null)
  const wasPlaying = useRef(false)

  const fracFromEvent = (e: React.PointerEvent) => {
    const r = track.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  const seek = (frac: number) => {
    if (video && Number.isFinite(video.duration)) video.currentTime = frac * video.duration
  }

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    onTouch?.()
    if (!video) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    wasPlaying.current = !video.paused
    video.pause() // hold still while the finger is down, like Instagram
    const f = fracFromEvent(e)
    setDragFrac(f)
    seek(f)
  }
  const onMove = (e: React.PointerEvent) => {
    if (dragFrac === null) return
    e.stopPropagation()
    const f = fracFromEvent(e)
    setDragFrac(f)
    seek(f)
  }
  const onEnd = (e: React.PointerEvent) => {
    if (dragFrac === null) return
    e.stopPropagation()
    setDragFrac(null)
    if (wasPlaying.current) video?.play().catch(() => {})
  }

  const dragging = dragFrac !== null
  const shown = dragging ? dragFrac! : progress
  const duration = video && Number.isFinite(video.duration) ? video.duration : 0

  return (
    <div className={`absolute z-[4] ${className}`}>
      {dragging && duration > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-8 bg-black/70 backdrop-blur text-white text-xs font-semibold px-2.5 py-1 rounded-full tabular-nums pointer-events-none">
          {fmt(shown * duration)} <span className="text-white/50">/ {fmt(duration)}</span>
        </div>
      )}
      <div
        ref={track}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shown * 100)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onClick={e => e.stopPropagation()}
        style={{ touchAction: 'none' }}
        className="relative h-6 flex items-end cursor-pointer select-none"
      >
        <div className={`relative w-full bg-white/20 transition-[height] duration-150 ${dragging ? 'h-1.5' : 'h-[3px]'}`}>
          <div className="absolute inset-y-0 left-0 bg-brand-red" style={{ width: `${shown * 100}%`, transition: dragging ? 'none' : 'width 300ms linear' }} />
          {dragging && (
            <span className="absolute top-1/2 w-3.5 h-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow" style={{ left: `${shown * 100}%` }} />
          )}
        </div>
      </div>
    </div>
  )
}

const HOLD_MS = 220
const SIDE = 0.34 // left / right third of the picture

/**
 * Full-picture touch layer:
 *  - quick tap            → toggles pause
 *  - press and hold the left or right side → 2x speed while held (like Instagram)
 * Vertical swipes still scroll the feed (touch-action: pan-y).
 */
export function TapHoldLayer({
  video, paused, onToggle, className = '', onTouch,
}: {
  video: HTMLVideoElement | null
  paused: boolean
  onToggle: () => void
  className?: string
  /** Called on any touch, so the player can reveal its overlay for a moment */
  onTouch?: () => void
}) {
  const [fast, setFast] = useState<'left' | 'right' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const active = useRef(false)

  const stopFast = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (held.current && video) video.playbackRate = 1
    setFast(null)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  // A different video starts at normal speed
  useEffect(() => { held.current = false; setFast(null) }, [video])

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onTouch?.()
    active.current = true
    held.current = false
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const side = x < SIDE ? 'left' : x > 1 - SIDE ? 'right' : null
    if (!side) return
    timer.current = setTimeout(() => {
      timer.current = null
      if (!video) return
      held.current = true
      video.playbackRate = 2
      if (video.paused) video.play().catch(() => {})
      setFast(side)
    }, HOLD_MS)
  }
  const onUp = () => {
    if (!active.current) return
    active.current = false
    const wasHeld = held.current
    stopFast()
    held.current = false
    if (!wasHeld) onToggle() // a plain tap
  }
  const onCancel = () => { // the browser took the gesture (a vertical scroll)
    active.current = false
    stopFast()
    held.current = false
  }

  return (
    <>
      <div
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onPointerLeave={() => { if (active.current && held.current) onCancel() }}
        onContextMenu={e => e.preventDefault()}
        role="button"
        aria-label={paused ? 'Play' : 'Pause'}
        style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        className={`absolute inset-0 z-[1] select-none flex items-center justify-center ${className}`}
      >
        {paused && !fast && (
          <span className="w-16 h-16 rounded-full bg-black/45 backdrop-blur flex items-center justify-center animate-scale-in pointer-events-none">
            <Play size={30} fill="white" className="text-white ml-1" />
          </span>
        )}
      </div>

      {fast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[4] pointer-events-none">
          <span className="flex items-center gap-1.5 bg-black/65 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full animate-fade-in">
            <span className="tracking-tighter">▶▶</span> 2x speed
          </span>
        </div>
      )}
    </>
  )
}
