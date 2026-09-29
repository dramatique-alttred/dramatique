'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X, Link2 } from 'lucide-react'
import { uploadImage, IMAGE_TYPES } from '@/lib/admin-upload'

/**
 * Poster / banner picker: drop or choose a file and it goes straight to R2;
 * `onChange` receives the public URL to save on the series. Pasting a URL
 * still works for images hosted elsewhere.
 */
export default function ImageUpload({ kind, value, onChange, seriesId }: {
  kind: 'poster' | 'banner'
  value: string
  onChange: (url: string) => void
  seriesId?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [showUrl, setShowUrl] = useState(false)

  const aspect = kind === 'poster' ? 'aspect-[2/3] w-32' : 'aspect-video w-full max-w-sm'

  const handleFile = async (file?: File) => {
    if (!file) return
    setError('')
    setProgress(0)
    try {
      onChange(await uploadImage(file, kind, seriesId, setProgress))
    } catch (err: any) {
      setError(err.message || 'Upload failed. Try again.')
    } finally {
      setProgress(null)
      if (input.current) input.current.value = ''
    }
  }

  const uploading = progress !== null

  return (
    <div>
      <div className="flex items-start gap-4 flex-wrap">
        <button
          type="button"
          disabled={uploading}
          onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
          className={`${aspect} relative flex-shrink-0 rounded-xl overflow-hidden border-2 border-dashed transition-colors bg-[#0a0a0f] ${dragging ? 'border-[#e8001d]' : 'border-[#24242f] hover:border-[#3a3a48]'}`}
        >
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center p-2 ${value ? 'bg-black/60 opacity-0 hover:opacity-100' : ''} ${uploading ? '!opacity-100 bg-black/70' : ''} transition-opacity`}>
            {uploading ? (
              <>
                <Loader2 size={20} className="text-white animate-spin" />
                <span className="text-white text-xs font-semibold">{progress}%</span>
              </>
            ) : (
              <>
                <ImagePlus size={20} className="text-[#8b8b9a]" />
                <span className="text-[#c2c2ce] text-xs font-medium">{value ? 'Replace' : 'Upload'}</span>
              </>
            )}
          </div>
        </button>

        <div className="flex-1 min-w-40 space-y-2 text-xs">
          <p className="text-[#5a5a68]">JPG, PNG or WebP · under 5 MB. Drop a file or click to choose.</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowUrl(s => !s)} className="inline-flex items-center gap-1 text-[#8b8b9a] hover:text-white">
              <Link2 size={12} /> {showUrl ? 'Hide URL' : 'Use a URL'}
            </button>
            {value && !uploading && (
              <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1 text-[#8b8b9a] hover:text-red-400">
                <X size={12} /> Remove
              </button>
            )}
          </div>
          {showUrl && (
            <input
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#0a0a0f] border border-[#24242f] rounded-xl px-3 py-2 text-white placeholder-[#5a5a68] text-xs outline-none focus:border-[#e8001d]"
            />
          )}
          {error && <p className="text-red-400">{error}</p>}
        </div>
      </div>
      <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  )
}
