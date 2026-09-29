import { parseVideoPath, verifyToken } from './token'

interface Env {
  MEDIA: R2Bucket
  MEDIA_TOKEN_SECRET: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*', // the token is the access control; any site may embed the player
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, ETag',
  'Access-Control-Max-Age': '86400',
}

const deny = (status: number, message: string) =>
  new Response(message, { status, headers: { ...CORS, 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } })

/** Streams an R2 object, honouring Range and conditional requests */
async function serve(env: Env, key: string, request: Request, cacheControl?: string) {
  const object = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers })
  if (!object) return deny(404, 'Not found')

  const headers = new Headers(CORS)
  object.writeHttpMetadata(headers) // Content-Type + Cache-Control stored at upload time
  headers.set('ETag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  if (cacheControl) headers.set('Cache-Control', cacheControl)

  // onlyIf failed (e.g. If-None-Match matched) → R2 returns metadata without a body
  if (!('body' in object)) return new Response(null, { status: 304, headers })

  let status = 200
  if (object.range && request.headers.has('Range')) {
    const r = object.range as { offset?: number; length?: number; suffix?: number }
    const offset = r.suffix !== undefined ? object.size - r.suffix : (r.offset ?? 0)
    const length = r.suffix !== undefined ? r.suffix : (r.length ?? object.size - offset)
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
    status = 206
  }
  return new Response(request.method === 'HEAD' ? null : object.body, { status, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (request.method !== 'GET' && request.method !== 'HEAD') return deny(405, 'Method not allowed')

    const { pathname } = new URL(request.url)

    // Posters and banners are public
    if (pathname.startsWith('/images/') && !pathname.includes('..')) {
      return serve(env, decodeURIComponent(pathname.slice(1)), request)
    }

    // Videos need a token scoped to that episode
    const video = parseVideoPath(pathname)
    if (video) {
      if (!env.MEDIA_TOKEN_SECRET) return deny(500, 'Worker is missing MEDIA_TOKEN_SECRET')
      if (!(await verifyToken(video.token, video.scope, env.MEDIA_TOKEN_SECRET))) return deny(403, 'Link expired or invalid')
      // The URL is only usable while the token lives; keep it out of shared caches
      return serve(env, video.key, request, 'private, max-age=3600')
    }

    return deny(404, 'Not found')
  },
} satisfies ExportedHandler<Env>
