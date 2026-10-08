'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Film, Upload, Loader2, RotateCcw, X, CheckCircle2, AlertTriangle } from '@/components/ui/icons'
import { adminEpisodeApi } from '@/lib/admin-api'
import { uploadEpisodeVideo, UploadCancelled, VIDEO_ACCEPT } from '@/lib/admin-upload'

const VideoPlayer = dynamic(() => import('@/components/player/VideoPlayer'), { ssr: false })

const mb = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(bytes < 100 * 1024 ** 2 ? 1 : 0)} MB`

/**
 * Episode video: upload (multipart, straight to R2) → server transcodes to
 * HLS → preview. The processing state comes from the episode itself, which
 * the parent query polls while it's busy; `onChanged` refreshes it.
 */
export default function VideoUpload({ episode, onChanged }: { episode: any; onChanged: () => Promise<unknown> }) {
  const input = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const [upload, setUpload] = useState<{ name: string; size: number; pct: number } | null>(null)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Leaving mid-upload loses it — warn before the tab closes
  useEffect(() => {
    if (!upload) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [upload])

  // Cancel an in-flight upload if the admin navigates away inside the app
  useEffect(() => () => controller.current?.abort(), [])

  const start = async (file?: File) => {
    if (!file || upload) return
    if (episode.status === 'ready' && !confirm('Replace the current video? The old one stays live until the new one finishes processing.')) return
    setError('')
    controller.current = new AbortController()
    setUpload({ name: file.name, size: file.size, pct: 0 })
    try {
      await uploadEpisodeVideo(episode.id, file, pct => setUpload(u => (u ? { ...u, pct } : u)), controller.current.signal)
      // Keep showing the upload row until the refreshed status arrives, so the drop zone doesn't flash back
      await onChanged()
    } catch (err: any) {
      if (!(err instanceof UploadCancelled)) setError(err.message || 'Upload failed. Try again.')
    } finally {
      controller.current = null
      setUpload(null)
      if (input.current) input.current.value = ''
    }
  }

  const retry = async () => {
    setRetrying(true)
    setError('')
    try {
      await adminEpisodeApi.retryVideo(episode.id)
      await onChanged()
    } catch (err: any) {
      setError(err.message || 'Could not restart processing.')
    } finally {
      setRetrying(false)
    }
  }

  const status: string = episode.status
  const busy = status === 'uploaded' || status === 'processing'

  return (
    <div className="space-y-3">
      {/* Current state */}
      {upload ? (
        <StatusRow icon={<Loader2 size={16} className="animate-spin text-blue-400" />} tone="text-blue-400"
          label={`Uploading ${upload.name} · ${mb(upload.size)}`} pct={upload.pct}
          action={<button onClick={() => controller.current?.abort()} className="text-[#8b8b9a] hover:text-white text-xs inline-flex items-center gap-1"><X size={12} /> Cancel</button>} />
      ) : status === 'uploaded' ? (
        <StatusRow icon={<Loader2 size={16} className="animate-spin text-amber-400" />} tone="text-amber-400" label="Uploaded — waiting to process" pct={0} />
      ) : status === 'processing' ? (
        <StatusRow icon={<Loader2 size={16} className="animate-spin text-amber-400" />} tone="text-amber-400"
          label="Processing into 1080p / 720p / 480p / 360p" pct={episode.transcode_progress ?? 0} />
      ) : status === 'failed' ? (
        <StatusRow icon={<AlertTriangle size={16} className="text-red-400" />} tone="text-red-400"
          label={`Processing failed${episode.video_error ? `: ${episode.video_error}` : ''}`}
          action={episode.has_source && (
            <button onClick={retry} disabled={retrying} className="text-[#c2c2ce] hover:text-white text-xs inline-flex items-center gap-1 disabled:opacity-50">
              {retrying ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Retry
            </button>
          )} />
      ) : status === 'ready' ? (
        <StatusRow icon={<CheckCircle2 size={16} className="text-emerald-400" />} tone="text-emerald-400" label="Ready to stream" />
      ) : null}

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-red-400 text-xs">{error}</div>}

      {/* Preview of the live version (stays up while a replacement processes) */}
      {episode.video_url && !upload && (
        <div className="w-48 aspect-[9/16] rounded-xl overflow-hidden bg-black">
          <VideoPlayer key={episode.video_url} src={episode.video_url} autoPlay={false} className="w-full h-full" />
        </div>
      )}

      {/* Drop zone */}
      {!upload && !busy && (
        <button type="button" onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); start(e.dataTransfer.files[0]) }}
          className={`w-full border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragging ? 'border-[#e8001d] bg-[#e8001d]/5' : 'border-[#24242f] hover:border-[#3a3a48]'}`}>
          {status === 'ready' ? <Upload size={22} className="text-[#5a5a68] mx-auto mb-2" /> : <Film size={26} className="text-[#5a5a68] mx-auto mb-2" />}
          <p className="text-white text-sm font-medium mb-1">{status === 'ready' || status === 'failed' ? 'Upload a replacement video' : 'Upload video'}</p>
          <p className="text-[#5a5a68] text-xs">MP4, MOV, WebM or MKV · up to 2 GB · vertical 9:16 recommended. Drop a file or click to choose.</p>
        </button>
      )}
      <input ref={input} type="file" accept={`video/*,${VIDEO_ACCEPT}`} className="hidden" onChange={e => start(e.target.files?.[0])} />
    </div>
  )
}

function StatusRow({ icon, label, tone, pct, action }: { icon: React.ReactNode; label: string; tone: string; pct?: number; action?: React.ReactNode }) {
  return (
    <div className="bg-[#0a0a0f] border border-[#24242f] rounded-xl p-3">
      <div className="flex items-center gap-2.5">
        {icon}
        <p className={`text-xs flex-1 min-w-0 break-words ${tone}`}>{label}</p>
        {pct !== undefined && <span className="text-xs text-[#c2c2ce] font-semibold tabular-nums">{pct}%</span>}
        {action}
      </div>
      {pct !== undefined && (
        <div className="h-1.5 bg-[#24242f] rounded-full mt-2.5 overflow-hidden">
          <div className="h-full bg-[#e8001d] rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}
