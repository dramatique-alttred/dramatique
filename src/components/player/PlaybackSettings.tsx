'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, ChevronLeft, Check, X, Gauge, MonitorPlay, PictureInPicture } from '@/components/ui/icons'
import type { QualityApi } from './VideoPlayer'

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
export const speedLabel = (s: number) => `${s.toFixed(s % 1 ? 2 : 1).replace(/(\.\d)0$/, '$1')}x`

type Panel = 'main' | 'quality' | 'speed'

/** Bottom sheet over the reel: quality, speed and picture-in-picture */
export default function PlaybackSettings({
  initial = 'main', video, quality, qualityChoice, onQualityChoice, speed, onSpeed, onClose,
}: {
  initial?: Panel
  video: HTMLVideoElement | null
  quality: QualityApi | null
  /** 'auto' or a picture height the viewer pinned */
  qualityChoice: 'auto' | number
  onQualityChoice: (c: 'auto' | number) => void
  speed: number
  onSpeed: (s: number) => void
  onClose: () => void
}) {
  const [panel, setPanel] = useState<Panel>(initial)
  const [pip, setPip] = useState(false)

  // Picture-in-picture: standard API (Chrome, Edge, desktop Safari) or Safari on iPhone
  type PipVideo = HTMLVideoElement & {
    webkitSupportsPresentationMode?: (m: string) => boolean
    webkitSetPresentationMode?: (m: string) => void
    webkitPresentationMode?: string
  }
  const v = video as PipVideo | null
  const stdPip = typeof document !== 'undefined' && !!document.pictureInPictureEnabled && !!v?.requestPictureInPicture
  const iosPip = !!v?.webkitSupportsPresentationMode?.('picture-in-picture')
  const pipSupported = stdPip || iosPip

  useEffect(() => {
    if (!v) return
    const sync = () => setPip(document.pictureInPictureElement === v || v.webkitPresentationMode === 'picture-in-picture')
    sync()
    v.addEventListener('enterpictureinpicture', sync)
    v.addEventListener('leavepictureinpicture', sync)
    v.addEventListener('webkitpresentationmodechanged', sync)
    return () => {
      v.removeEventListener('enterpictureinpicture', sync)
      v.removeEventListener('leavepictureinpicture', sync)
      v.removeEventListener('webkitpresentationmodechanged', sync)
    }
  }, [v])

  const togglePip = async () => {
    if (!v) return
    try {
      if (stdPip) {
        if (document.pictureInPictureElement === v) await document.exitPictureInPicture()
        else { await v.requestPictureInPicture(); onClose() }
      } else if (iosPip) {
        const on = v.webkitPresentationMode === 'picture-in-picture'
        v.webkitSetPresentationMode?.(on ? 'inline' : 'picture-in-picture')
        if (!on) onClose()
      }
    } catch { /* the browser refused (no user gesture, or video not ready) */ }
  }

  const heights = quality?.heights() ?? []
  const qualityValue =
    qualityChoice === 'auto'
      ? `Auto${quality?.activeHeight() ? ` (${quality.activeHeight()}p)` : ''}`
      : `${qualityChoice}p`

  const row = 'w-full flex items-center gap-4 px-5 py-4 text-left active:bg-white/5'
  const option = (label: string, selected: boolean, onPick: () => void) => (
    <button key={label} onClick={onPick} className={`${row} justify-between`}>
      <span className={`text-sm font-semibold ${selected ? 'text-white' : 'text-brand-text'}`}>{label}</span>
      {selected && <Check size={18} className="text-brand-red" />}
    </button>
  )

  return (
    <div className="absolute inset-0 z-30 bg-black/40 flex items-end md:items-center justify-center animate-fade-in" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full md:max-w-md bg-[#1c1c1e] rounded-t-2xl md:rounded-2xl overflow-hidden animate-slide-up pb-[env(safe-area-inset-bottom)]">
        {/* title */}
        <div className="relative flex items-center justify-center px-5 py-4">
          {panel !== 'main' && (
            <button onClick={() => setPanel('main')} aria-label="Back" className="absolute left-3 p-2 text-white"><ChevronLeft size={20} /></button>
          )}
          <h3 className="text-white font-semibold text-base">
            {panel === 'main' ? 'Playback Settings' : panel === 'quality' ? 'Quality' : 'Speed'}
          </h3>
          <button onClick={onClose} aria-label="Close" className="absolute right-3 p-2 text-white"><X size={20} /></button>
        </div>

        {panel === 'main' && (
          <div className="pb-4">
            <button onClick={() => setPanel('quality')} className={row} disabled={!quality}>
              <MonitorPlay size={24} className="text-white flex-shrink-0" />
              <span className="flex-1 text-white text-sm font-semibold">Current Quality</span>
              <span className="text-brand-subtle text-sm">{qualityValue}</span>
              <ChevronRight size={18} className="text-brand-subtle" />
            </button>
            <button onClick={() => setPanel('speed')} className={row}>
              <Gauge size={24} className="text-white flex-shrink-0" />
              <span className="flex-1 text-white text-sm font-semibold">Speed</span>
              <span className="text-brand-subtle text-sm">{speedLabel(speed)}</span>
              <ChevronRight size={18} className="text-brand-subtle" />
            </button>
            {pipSupported && (
              <button onClick={togglePip} className={row}>
                <PictureInPicture size={24} className="text-white flex-shrink-0" />
                <span className="flex-1 text-white text-sm font-semibold">Picture-in-Picture</span>
                <span className={`relative w-12 h-7 rounded-full transition-colors ${pip ? 'bg-brand-red' : 'bg-white/20'}`}>
                  <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${pip ? 'left-[22px]' : 'left-0.5'}`} />
                </span>
              </button>
            )}
          </div>
        )}

        {panel === 'quality' && (
          <div className="pb-4 max-h-[50vh] overflow-y-auto">
            {option('Auto', qualityChoice === 'auto', () => { onQualityChoice('auto'); setPanel('main') })}
            {heights.map(h => option(`${h}p`, qualityChoice === h, () => { onQualityChoice(h); setPanel('main') }))}
          </div>
        )}

        {panel === 'speed' && (
          <div className="pb-4">
            {SPEEDS.map(s => option(speedLabel(s), speed === s, () => { onSpeed(s); setPanel('main') }))}
          </div>
        )}
      </div>
    </div>
  )
}
