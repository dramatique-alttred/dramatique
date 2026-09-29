import { createHmac } from 'node:crypto'
import { publicUrl } from './storage'

/**
 * Signed video URLs, checked by the media Worker (workers/media/src/token.ts —
 * keep the two formats identical).
 *
 *   <R2_PUBLIC_BASE_URL>/t/<exp>.<sig>/videos/<episodeId>/v…/master.m3u8
 *   sig = base64url(HMAC-SHA256(MEDIA_TOKEN_SECRET, "videos/<episodeId>/\n<exp>"))
 *
 * Without MEDIA_TOKEN_SECRET (local dev against the open r2.dev URL) plain
 * public URLs are returned instead.
 */

const SECRET = process.env.MEDIA_TOKEN_SECRET ?? ''
const TTL_SECONDS = Number(process.env.MEDIA_TOKEN_TTL_SECONDS) || 2 * 60 * 60

export const mediaSigningEnabled = SECRET.length > 0
if (mediaSigningEnabled && SECRET.length < 32) throw new Error('MEDIA_TOKEN_SECRET must be at least 32 characters')

export function signScope(scope: string, exp: number, secret = SECRET) {
  const sig = createHmac('sha256', secret).update(`${scope}\n${exp}`).digest('base64url')
  return `${exp}.${sig}`
}

/** URL for an episode's HLS master playlist that only works for TTL_SECONDS */
export function videoUrl(manifestKey: string, now = Date.now()) {
  if (!mediaSigningEnabled) return publicUrl(manifestKey)
  const m = /^(videos\/[0-9a-f-]{36}\/)/i.exec(manifestKey)
  if (!m) throw new Error(`Unexpected manifest key: ${manifestKey}`)
  const exp = Math.floor(now / 1000) + TTL_SECONDS
  return publicUrl(`t/${signScope(m[1], exp)}/${manifestKey}`)
}

export const videoUrlTtlSeconds = TTL_SECONDS
