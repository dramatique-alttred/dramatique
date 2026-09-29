import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { prisma } from '../../config/prisma'
import { HttpError } from '../../lib/http'
import {
  buckets, storageConfigured, presignPut, startMultipart, presignPart, completeMultipart, abortMultipart,
  downloadToFile, uploadDirectory, deletePrefix, deleteObject, publicUrl,
} from '../../lib/storage'
import { ffmpegTranscoder, Transcoder } from './ffmpeg.transcoder'

type Body = Record<string, unknown>

const transcoder: Transcoder = ffmpegTranscoder

const MAX_VIDEO_BYTES = 2 * 1024 ** 3 // 2 GB
const PART_SIZE = 10 * 1024 ** 2 // 10 MB — R2 needs ≥5 MB for all but the last part
const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv',
}
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAX_IMAGE_BYTES = 5 * 1024 ** 2

function requireStorage() {
  if (!storageConfigured) throw new HttpError(503, 'Storage is not configured on the server (R2_* env vars)')
}

// ── Images (posters / banners) ──────────────────────────────────────────

export async function createImageUpload(body: Body) {
  requireStorage()
  const kind = body.kind === 'banner' ? 'banner' : body.kind === 'poster' ? 'poster' : null
  if (!kind) throw new HttpError(400, 'kind must be poster or banner')
  const contentType = String(body.contentType ?? '')
  const ext = IMAGE_TYPES[contentType]
  if (!ext) throw new HttpError(400, 'Use a JPG, PNG or WebP image')
  const size = Number(body.size)
  if (!Number.isInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) throw new HttpError(400, 'Images must be under 5 MB')
  // New series don't have an id yet — their images live under "drafts"
  const owner = typeof body.seriesId === 'string' && /^[0-9a-f-]{36}$/i.test(body.seriesId) ? body.seriesId : 'drafts'

  const key = `images/series/${owner}/${kind}-${Date.now()}.${ext}`
  const { url: uploadUrl, headers } = await presignPut(buckets.media, key, contentType, size)
  return {
    uploadUrl,
    headers, // the browser must send exactly these with the PUT
    url: publicUrl(key), // store this on the series once the PUT succeeds
    key,
  }
}

// ── Video uploads (multipart, straight from the browser to R2) ────────────

async function loadEpisode(id: string) {
  const ep = await prisma.episode.findUnique({ where: { id } })
  if (!ep) throw new HttpError(404, 'Episode not found')
  return ep
}

export async function createVideoUpload(episodeId: string, body: Body) {
  requireStorage()
  await loadEpisode(episodeId)
  const contentType = String(body.contentType ?? '')
  const ext = VIDEO_TYPES[contentType]
  if (!ext) throw new HttpError(400, 'Use an MP4, MOV, WebM or MKV video')
  const size = Number(body.size)
  if (!Number.isInteger(size) || size <= 0) throw new HttpError(400, 'size is required')
  if (size > MAX_VIDEO_BYTES) throw new HttpError(400, 'Videos must be under 2 GB')

  const key = `raw/${episodeId}/${Date.now()}.${ext}`
  const uploadId = await startMultipart(buckets.uploads, key, contentType)
  const partCount = Math.ceil(size / PART_SIZE)
  const parts = await Promise.all(Array.from({ length: partCount }, (_, i) =>
    presignPart(buckets.uploads, key, uploadId, i + 1).then(url => ({ partNumber: i + 1, url }))))
  return { key, uploadId, partSize: PART_SIZE, parts }
}

function assertOwnKey(episodeId: string, key: unknown): string {
  if (typeof key !== 'string' || !key.startsWith(`raw/${episodeId}/`) || key.includes('..')) {
    throw new HttpError(400, 'Invalid upload key')
  }
  return key
}

export async function completeVideoUpload(episodeId: string, body: Body) {
  const key = assertOwnKey(episodeId, body.key)
  const uploadId = String(body.uploadId ?? '')
  const parts = body.parts
  if (!uploadId || !Array.isArray(parts) || !parts.length) throw new HttpError(400, 'uploadId and parts are required')
  const clean = parts.map((p: any) => {
    const PartNumber = Number(p?.PartNumber ?? p?.partNumber)
    const ETag = String(p?.ETag ?? p?.etag ?? '')
    if (!Number.isInteger(PartNumber) || PartNumber < 1 || !ETag) throw new HttpError(400, 'Each part needs a PartNumber and ETag')
    return { PartNumber, ETag }
  })

  const before = await loadEpisode(episodeId)
  await completeMultipart(buckets.uploads, key, uploadId, clean)
  await prisma.episode.update({
    where: { id: episodeId },
    data: { sourceKey: key, videoStatus: 'UPLOADED', transcodeProgress: 0, videoError: null },
  })
  // The raw file this one replaces is no longer needed
  if (before.sourceKey && before.sourceKey !== key) await deleteObject(buckets.uploads, before.sourceKey)

  enqueue(episodeId)
  return { queued: true }
}

export async function abortVideoUpload(episodeId: string, body: Body) {
  const key = assertOwnKey(episodeId, body.key)
  await abortMultipart(buckets.uploads, key, String(body.uploadId ?? ''))
  return { aborted: true }
}

export async function retryTranscode(episodeId: string) {
  const ep = await loadEpisode(episodeId)
  if (!ep.sourceKey) throw new HttpError(400, 'Upload a video first')
  if (ep.videoStatus === 'PROCESSING') throw new HttpError(409, 'Already processing')
  await prisma.episode.update({ where: { id: episodeId }, data: { videoStatus: 'UPLOADED', transcodeProgress: 0, videoError: null } })
  enqueue(episodeId)
  return { queued: true }
}

// ── Cleanup when content is deleted ─────────────────────────────────────
// Best effort: the database rows are already gone, so a storage hiccup is
// logged rather than failing the delete. An in-flight transcode notices the
// episode is gone and removes its own output.

async function removeMedia(what: string, work: Promise<unknown>[]) {
  if (!storageConfigured) return
  const failed = (await Promise.allSettled(work)).filter(r => r.status === 'rejected')
  if (failed.length) console.error(`[video] cleanup of ${what} incomplete:`, (failed[0] as PromiseRejectedResult).reason?.message)
}

const episodeFiles = (id: string) => [
  deletePrefix(buckets.media, `videos/${id}/`),
  deletePrefix(buckets.uploads, `raw/${id}/`),
]

export function deleteEpisodeMedia(episodeId: string) {
  return removeMedia(`episode ${episodeId}`, episodeFiles(episodeId))
}

/** A series' images and every episode's video. `imageUrls` covers images uploaded before the series existed ("drafts"). */
export function deleteSeriesMedia(seriesId: string, episodeIds: string[], imageUrls: (string | null)[]) {
  const base = publicUrl('')
  const draftKeys = imageUrls
    .filter((u): u is string => !!u && u.startsWith(`${base}images/series/drafts/`))
    .map(u => u.slice(base.length))
  return removeMedia(`series ${seriesId}`, [
    deletePrefix(buckets.media, `images/series/${seriesId}/`),
    ...draftKeys.map(k => deleteObject(buckets.media, k)),
    ...episodeIds.flatMap(episodeFiles),
  ])
}

// ── Processing queue ────────────────────────────────────────────────────
// The database is the queue: an episode in UPLOADED/PROCESSING state needs
// work, so jobs survive restarts. One video at a time keeps the API server
// responsive; in production this loop moves to a separate worker process.

const queue: string[] = []
let running = false

export function enqueue(episodeId: string) {
  if (!queue.includes(episodeId)) queue.push(episodeId)
  void drain()
}

async function drain() {
  if (running) return
  running = true
  try {
    while (queue.length) await processEpisode(queue.shift()!)
  } finally {
    running = false
  }
}

/** On boot: pick up anything that was uploaded or interrupted mid-transcode */
export async function resumePendingJobs() {
  if (!storageConfigured) return
  const pending = await prisma.episode.findMany({
    where: { videoStatus: { in: ['UPLOADED', 'PROCESSING'] }, sourceKey: { not: null } },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
  })
  pending.forEach(p => enqueue(p.id))
  if (pending.length) console.log(`[video] resumed ${pending.length} pending transcode job(s)`)
}

async function processEpisode(episodeId: string) {
  const ep = await prisma.episode.findUnique({ where: { id: episodeId } })
  if (!ep?.sourceKey) return
  const sourceKey = ep.sourceKey
  const work = await mkdtemp(path.join(os.tmpdir(), 'dramatique-'))
  const prefix = `videos/${episodeId}/v${Date.now()}`
  const started = Date.now()

  try {
    await prisma.episode.update({ where: { id: episodeId }, data: { videoStatus: 'PROCESSING', transcodeProgress: 0, videoError: null } })

    const input = path.join(work, `source${path.extname(sourceKey)}`)
    await downloadToFile(buckets.uploads, sourceKey, input)

    const outDir = path.join(work, 'hls')
    const result = await transcoder.transcode(input, outDir, pct => {
      prisma.episode.update({ where: { id: episodeId }, data: { transcodeProgress: pct } }).catch(() => {})
    })
    const files = await uploadDirectory(buckets.media, outDir, prefix)

    // A newer upload may have replaced the source while we worked — theirs wins
    const now = await prisma.episode.findUnique({ where: { id: episodeId } })
    if (!now || now.sourceKey !== sourceKey) {
      await deletePrefix(buckets.media, prefix)
      return
    }

    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        videoStatus: 'READY',
        hlsManifestKey: `${prefix}/${result.masterPlaylist}`,
        durationSeconds: result.durationSeconds,
        transcodeProgress: 100,
        videoError: null,
      },
    })
    // Remove the previous version only after the new one is live
    const oldPrefix = now.hlsManifestKey ? path.posix.dirname(now.hlsManifestKey) : null
    if (oldPrefix && oldPrefix.startsWith(`videos/${episodeId}/`) && oldPrefix !== prefix) await deletePrefix(buckets.media, oldPrefix)

    console.log(`[video] ${episodeId} ready: ${result.renditions.join('/')} · ${files} files · ${Math.round((Date.now() - started) / 1000)}s`)
  } catch (err) {
    const message = (err as Error).message.slice(0, 500)
    console.error(`[video] ${episodeId} failed:`, message)
    await deletePrefix(buckets.media, prefix).catch(() => {})
    await prisma.episode.update({ where: { id: episodeId }, data: { videoStatus: 'FAILED', videoError: message } }).catch(() => {})
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {})
  }
}
