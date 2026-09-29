/**
 * Playback tokens. The API (backend/src/lib/media-token.ts) issues them after
 * deciding a viewer may watch an episode; this Worker checks them.
 *
 *   token = "<exp>.<sig>"
 *   exp   = unix seconds when it stops working
 *   sig   = base64url(HMAC-SHA256(secret, "<scope>\n<exp>"))
 *   scope = "videos/<episodeId>/"  — one token opens one episode, nothing else
 *
 * The token sits in the URL path (/t/<token>/videos/…), so the relative links
 * inside HLS playlists carry it to every rendition and segment automatically.
 */

const enc = new TextEncoder()

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  try {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  } catch {
    return null
  }
}

const keys = new Map<string, Promise<CryptoKey>>()
function hmacKey(secret: string) {
  let key = keys.get(secret)
  if (!key) {
    key = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    keys.set(secret, key)
  }
  return key
}

/** True if `token` is a genuine, unexpired token for `scope`. Constant-time (crypto.subtle.verify). */
export async function verifyToken(token: string, scope: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const dot = token.indexOf('.')
  if (dot < 1) return false
  const expText = token.slice(0, dot)
  if (!/^\d{1,12}$/.test(expText)) return false
  const exp = Number(expText)
  if (exp < nowSeconds) return false
  const sig = fromBase64Url(token.slice(dot + 1))
  if (!sig || sig.length !== 32) return false
  return crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(`${scope}\n${exp}`))
}

/** Splits "/t/<token>/videos/<episodeId>/<rest>" into its parts, or null if it isn't one. */
export function parseVideoPath(pathname: string) {
  const m = /^\/t\/([^/]+)\/(videos\/([0-9a-f-]{36})\/(.+))$/i.exec(pathname)
  if (!m) return null
  const [, token, key, episodeId, rest] = m
  if (rest.split('/').some(part => part === '' || part === '.' || part === '..')) return null
  return { token, key, scope: `videos/${episodeId}/` }
}
