import { createReadStream, createWriteStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, ListObjectsV2Command,
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Object storage on Cloudflare R2 through the S3 API. Anything S3-compatible
 * works (MinIO locally, AWS S3) by changing env vars only.
 *
 *   media   — public (via CDN): posters, banners, HLS output
 *   uploads — private: raw video from the admin panel
 */

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_MEDIA_BUCKET, R2_UPLOADS_BUCKET, R2_PUBLIC_BASE_URL } = process.env

export const storageConfigured = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_MEDIA_BUCKET && R2_UPLOADS_BUCKET && R2_PUBLIC_BASE_URL)
if (!storageConfigured) console.warn('[storage] R2_* env vars incomplete — uploads and video processing are disabled')

export const buckets = {
  media: R2_MEDIA_BUCKET ?? '',
  uploads: R2_UPLOADS_BUCKET ?? '',
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID ?? '', secretAccessKey: R2_SECRET_ACCESS_KEY ?? '' },
})

export const publicUrl = (key: string) => `${(R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')}/${key}`

// Everything we write to the media bucket gets a unique, versioned path, so
// it can be cached forever and never needs a CDN purge.
const IMMUTABLE = 'public, max-age=31536000, immutable'

const CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.vtt': 'text/vtt',
}
export const contentTypeFor = (file: string) => CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'

// ── Direct browser uploads (presigned) ──────────────────────────────────

/**
 * Single PUT, signed together with its headers: the browser must send exactly
 * these (returned as `headers`), so it can't change the type, size or caching.
 */
export async function presignPut(bucket: string, key: string, contentType: string, contentLength: number, expiresIn = 600) {
  const headers: Record<string, string> = { 'Content-Type': contentType }
  if (bucket === buckets.media) headers['Cache-Control'] = IMMUTABLE
  const url = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength,
    CacheControl: headers['Cache-Control'],
  }), { expiresIn, signableHeaders: new Set(['content-type', 'content-length', 'cache-control']) })
  return { url, headers }
}

export async function startMultipart(bucket: string, key: string, contentType: string) {
  const res = await s3.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }))
  return res.UploadId!
}

export function presignPart(bucket: string, key: string, uploadId: string, partNumber: number, expiresIn = 3600) {
  return getSignedUrl(s3, new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn })
}

export async function completeMultipart(bucket: string, key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]) {
  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: bucket, Key: key, UploadId: uploadId,
    MultipartUpload: { Parts: [...parts].sort((a, b) => a.PartNumber - b.PartNumber) },
  }))
}

export async function abortMultipart(bucket: string, key: string, uploadId: string) {
  await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId })).catch(() => {})
}

// ── Server-side transfers (used by the transcoder) ──────────────────────

export async function downloadToFile(bucket: string, key: string, dest: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  await pipeline(res.Body as Readable, createWriteStream(dest))
}

export async function uploadFile(bucket: string, key: string, file: string) {
  const { size } = await stat(file)
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: createReadStream(file), ContentLength: size,
    ContentType: contentTypeFor(file), CacheControl: IMMUTABLE,
  }))
}

/** Uploads every file under `dir` to `prefix/…`, a few at a time */
export async function uploadDirectory(bucket: string, dir: string, prefix: string, concurrency = 8) {
  const files: string[] = []
  const walk = async (d: string) => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) await walk(full)
      else files.push(full)
    }
  }
  await walk(dir)

  let next = 0
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++]
      const key = `${prefix}/${path.relative(dir, file).split(path.sep).join('/')}`
      await uploadFile(bucket, key, file)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker))
  return files.length
}

export async function deletePrefix(bucket: string, prefix: string) {
  if (!prefix.endsWith('/')) prefix += '/' // never delete by a partial name
  let token: string | undefined
  do {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }))
    const keys = (list.Contents ?? []).map(o => ({ Key: o.Key! }))
    if (keys.length) await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }))
    token = list.IsTruncated ? list.NextContinuationToken : undefined
  } while (token)
}

export async function deleteObject(bucket: string, key: string) {
  await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: key }], Quiet: true } })).catch(() => {})
}
