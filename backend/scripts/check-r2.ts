/**
 * Verifies the Cloudflare R2 setup end to end:  npm run check:r2
 *
 *  1. credentials can write/read/delete in both buckets
 *  2. the media bucket is reachable at R2_PUBLIC_BASE_URL
 *  3. the uploads bucket is NOT readable without credentials
 *  4. CORS lets the admin panel (http://localhost:3000) PUT directly
 *
 * Creates tiny files under _healthcheck/ and deletes them afterwards.
 */
import 'dotenv/config'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
  const key = `_healthcheck/${Date.now()}.txt`
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
