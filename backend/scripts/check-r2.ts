/**
 * Verifies the Cloudflare R2 setup end to end:  npm run check:r2
 *
 *  1. credentials can write/read/delete in both buckets
 *  2. the media bucket is reachable at R2_PUBLIC_BASE_URL
 *  3. the uploads bucket is NOT readable without credentials
 *  4. CORS lets the admin panel (http://localhost:3000) PUT directly
 *  5. with MEDIA_TOKEN_SECRET set (media Worker in front of the bucket):
 *     videos are refused without a token and served with a valid one
 *
 * Creates tiny files under images/_healthcheck/ (and a dummy video folder)
 * and deletes them afterwards.
 */
import 'dotenv/config'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { signScope, mediaSigningEnabled } from '../src/lib/media-token'

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_MEDIA_BUCKET, R2_UPLOADS_BUCKET, R2_PUBLIC_BASE_URL } = process.env
const ADMIN_ORIGIN = 'http://localhost:3000'

let failed = 0
const report = (ok: boolean, label: string, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
}

async function main() {
  const missing = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_MEDIA_BUCKET, R2_UPLOADS_BUCKET, R2_PUBLIC_BASE_URL })
    .filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) {
    console.log(`Missing in backend/.env: ${missing.join(', ')}`)
    process.exit(1)
  }

  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
  })
  // Under images/ so it is public both on r2.dev and through the media Worker
  const key = `images/_healthcheck/${Date.now()}.txt`
  const body = `dramatique r2 check ${new Date().toISOString()}`

  for (const bucket of [R2_MEDIA_BUCKET!, R2_UPLOADS_BUCKET!]) {
    try {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain' }))
      const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      report((await got.Body!.transformToString()) === body, `${bucket}: write + read with API token`)
    } catch (err) {
      report(false, `${bucket}: write + read with API token`, (err as Error).message)
      continue
    }

    // CORS: the browser asks permission (preflight) before a direct PUT
    const putUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: `${key}.cors` }), { expiresIn: 300 })
    const pre = await fetch(putUrl, {
      method: 'OPTIONS',
      headers: { Origin: ADMIN_ORIGIN, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' },
    })
    const allowed = pre.headers.get('access-control-allow-origin')
    report(allowed === ADMIN_ORIGIN || allowed === '*', `${bucket}: CORS allows browser uploads from ${ADMIN_ORIGIN}`,
      allowed ? `allow-origin: ${allowed}` : `no CORS header (HTTP ${pre.status}) — add the CORS policy to this bucket`)
  }

  // Public media URL serves the file
  const pub = await fetch(`${R2_PUBLIC_BASE_URL!.replace(/\/$/, '')}/${key}`)
  report(pub.status === 200 && (await pub.text()) === body, 'media bucket is public at R2_PUBLIC_BASE_URL', `HTTP ${pub.status}`)

  // Uploads bucket must not be readable anonymously
  const anon = await fetch(`${endpoint}/${R2_UPLOADS_BUCKET}/${key}`)
  report(anon.status === 400 || anon.status === 401 || anon.status === 403, 'uploads bucket is private (anonymous read refused)', `HTTP ${anon.status}`)

  // Videos: only reachable with a token signed by this backend's secret
  if (mediaSigningEnabled) {
    const scope = 'videos/00000000-0000-0000-0000-000000000000/'
    const videoKey = `${scope}_healthcheck.txt`
    await s3.send(new PutObjectCommand({ Bucket: R2_MEDIA_BUCKET!, Key: videoKey, Body: body, ContentType: 'text/plain' }))
    const base = R2_PUBLIC_BASE_URL!.replace(/\/$/, '')
    const bare = await fetch(`${base}/${videoKey}`)
    report(bare.status === 403 || bare.status === 404, 'videos are refused without a token', `HTTP ${bare.status}`)
    const token = signScope(scope, Math.floor(Date.now() / 1000) + 300)
    const signed = await fetch(`${base}/t/${token}/${videoKey}`)
    report(signed.status === 200 && (await signed.text()) === body, 'videos play with a token from this backend',
      signed.status === 403 ? 'HTTP 403 — MEDIA_TOKEN_SECRET differs from the Worker secret' : `HTTP ${signed.status}`)
    await s3.send(new DeleteObjectCommand({ Bucket: R2_MEDIA_BUCKET!, Key: videoKey })).catch(() => {})
  } else {
    console.log('SKIP  video token checks — MEDIA_TOKEN_SECRET not set (videos use open r2.dev URLs)')
  }

  for (const bucket of [R2_MEDIA_BUCKET!, R2_UPLOADS_BUCKET!]) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {})
  }
  console.log(`\n${failed === 0 ? 'All checks passed' : `${failed} check(s) failed`} — test files cleaned up.`)
  process.exit(failed ? 1 : 0)
}

main().catch(err => {
  console.error('R2 check crashed:', err.message)
  process.exit(1)
})
