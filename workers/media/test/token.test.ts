import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyToken, parseVideoPath } from '../src/token.ts'

// Same recipe as backend/src/lib/media-token.ts
const SECRET = 'x'.repeat(40)
const sign = (scope: string, exp: number, secret = SECRET) =>
  `${exp}.${createHmac('sha256', secret).update(`${scope}\n${exp}`).digest('base64url')}`

const EP = '11111111-2222-3333-4444-555555555555'
const OTHER = '99999999-2222-3333-4444-555555555555'
const scope = `videos/${EP}/`
const now = 1_800_000_000

test('accepts a valid, unexpired token for its episode', async () => {
  assert.equal(await verifyToken(sign(scope, now + 60), scope, SECRET, now), true)
})

test('rejects expired tokens', async () => {
  assert.equal(await verifyToken(sign(scope, now - 1), scope, SECRET, now), false)
})

test('a token for one episode does not open another', async () => {
  assert.equal(await verifyToken(sign(scope, now + 60), `videos/${OTHER}/`, SECRET, now), false)
})

test('rejects a wrong secret, tampered expiry and junk', async () => {
  assert.equal(await verifyToken(sign(scope, now + 60, 'y'.repeat(40)), scope, SECRET, now), false)
  const [, sig] = sign(scope, now + 60).split('.')
  assert.equal(await verifyToken(`${now + 99999}.${sig}`, scope, SECRET, now), false)
  for (const junk of ['', '.', 'abc', `${now + 60}.`, `${now + 60}.!!!`, `-5.${sig}`, `${now + 60}.${sig}x`]) {
    assert.equal(await verifyToken(junk, scope, SECRET, now), false, junk)
  }
})

test('parses token URLs and refuses path tricks', () => {
  assert.deepEqual(parseVideoPath(`/t/123.abc/videos/${EP}/v1/720p/seg_001.ts`), {
    token: '123.abc', key: `videos/${EP}/v1/720p/seg_001.ts`, scope,
  })
  assert.equal(parseVideoPath(`/videos/${EP}/v1/master.m3u8`), null) // no token
  assert.equal(parseVideoPath(`/t/123.abc/videos/${EP}/../${OTHER}/v1/master.m3u8`), null)
  assert.equal(parseVideoPath(`/t/123.abc/videos/${EP}//x`), null)
  assert.equal(parseVideoPath(`/t/123.abc/videos/not-a-uuid/v1/master.m3u8`), null)
  assert.equal(parseVideoPath(`/t/123.abc/images/${EP}/a.png`), null)
})
