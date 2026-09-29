/**
 * Direct browser → R2 uploads for the admin panel.
 *
 * The API only hands out presigned URLs; the file bytes never pass through
 * our server. XHR (not fetch) is used because it reports upload progress.
 */

import { adminEpisodeApi, adminMediaApi } from './admin-api'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_BYTES = 5 * 1024 ** 2
export const MAX_VIDEO_BYTES = 2 * 1024 ** 3

// Browsers often leave File.type empty for .mkv (and sometimes .mov)
const VIDEO_EXT_TYPES: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
}
export const VIDEO_ACCEPT = Object.keys(VIDEO_EXT_TYPES).map(e => `.${e}`).join(',')

export function videoContentType(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fromExt = VIDEO_EXT_TYPES[ext]
  if (Object.values(VIDEO_EXT_TYPES).includes(file.type)) return file.type
  return fromExt ?? null
}

export class UploadCancelled extends Error {
  constructor() { super('Upload cancelled'); this.name = 'UploadCancelled' }
}

/** PUT a blob to a presigned URL, reporting bytes sent. Resolves with the ETag (if exposed). */
function put(url: string, body: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void, signal?: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadCancelled())
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    // The browser sets Content-Length itself and refuses to let scripts do it
    for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() !== 'content-length') xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = e => onProgress(e.loaded)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(body.size)
        resolve(xhr.getResponseHeader('ETag') ?? '')
      } else reject(new Error(`Storage rejected the upload (HTTP ${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Network error while uploading'))
    xhr.onabort = () => reject(new UploadCancelled())
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

// ── Images ──────────────────────────────────────────

/** Uploads a poster/banner and returns its public URL (to store on the series). */
export async function uploadImage(
  file: File, kind: 'poster' | 'banner', seriesId: string | undefined, onProgress: (pct: number) => void,
) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Use a JPG, PNG or WebP image')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be under 5 MB')
  const { uploadUrl, headers, url } = await adminMediaApi.createImageUpload({ kind, contentType: file.type, size: file.size, seriesId })
  await put(uploadUrl, file, headers, loaded => onProgress(Math.round((loaded / file.size) * 100)))
  return url
}

// ── Videos (multipart) ──────────────────────────────────────────

const PARALLEL_PARTS = 4
const PART_ATTEMPTS = 3

/**
 * Uploads an episode's source video in parts, then tells the server to start
 * transcoding. On failure or cancel the multipart upload is aborted so R2
 * doesn't keep the orphaned parts.
 */
export async function uploadEpisodeVideo(
  episodeId: string, file: File, onProgress: (pct: number) => void, signal?: AbortSignal,
) {
  const contentType = videoContentType(file)
  if (!contentType) throw new Error('Use an MP4, MOV, WebM or MKV video')
  if (file.size > MAX_VIDEO_BYTES) throw new Error('Videos must be under 2 GB')

  const { key, uploadId, partSize, parts } = await adminEpisodeApi.startVideoUpload(episodeId, {
    size: file.size, contentType, filename: file.name,
  })

  const sent = new Array<number>(parts.length).fill(0)
  const report = () => onProgress(Math.min(99, Math.floor((sent.reduce((a, b) => a + b, 0) / file.size) * 100)))
  const etags: { PartNumber: number; ETag: string }[] = []
  // One failed part stops the others instead of letting them keep uploading
  const stop = new AbortController()
  signal?.addEventListener('abort', () => stop.abort(), { once: true })

  const uploadPart = async (i: number) => {
    const { partNumber, url } = parts[i]
    const chunk = file.slice((partNumber - 1) * partSize, partNumber * partSize)
    for (let attempt = 1; ; attempt++) {
      try {
        const etag = await put(url, chunk, {}, loaded => { sent[i] = loaded; report() }, stop.signal)
        if (!etag) throw new Error('Storage did not return an ETag — check the uploads bucket CORS (ExposeHeaders: ETag)')
        etags.push({ PartNumber: partNumber, ETag: etag })
        return
      } catch (err) {
        sent[i] = 0
        if (err instanceof UploadCancelled || stop.signal.aborted || attempt >= PART_ATTEMPTS) throw err
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }
    }
  }

  try {
    let next = 0
    const worker = async () => { while (next < parts.length) await uploadPart(next++) }
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, parts.length) }, worker))
    etags.sort((a, b) => a.PartNumber - b.PartNumber)
    await adminEpisodeApi.completeVideoUpload(episodeId, { key, uploadId, parts: etags })
    onProgress(100)
  } catch (err) {
    stop.abort()
    adminEpisodeApi.abortVideoUpload(episodeId, { key, uploadId }).catch(() => {})
    throw signal?.aborted ? new UploadCancelled() : err
  }
}
