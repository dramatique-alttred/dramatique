# Media Worker

The only public way into the `dramatique-media` R2 bucket.

| Path | Access |
|---|---|
| `/images/…` | Public (posters, banners) |
| `/t/<token>/videos/<episodeId>/…` | Needs a token from `GET /api/v1/playback/:episodeId` (or the admin API). Tokens work for one episode and expire (2 h by default) |
| anything else | 404 |

The token sits in the URL path, so the relative links inside HLS playlists
carry it to every quality level and segment. The player needs no changes.
Token format: `src/token.ts` (checks) ↔ `backend/src/lib/media-token.ts` (signs). Keep them identical.

## First deploy

```bash
cd workers/media
npm install
npx wrangler login                      # opens the browser; approve access to the Cloudflare account
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # → the secret
npx wrangler secret put MEDIA_TOKEN_SECRET                                 # paste it
npx wrangler deploy                     # prints https://media-dramatique.<subdomain>.workers.dev
```

Then in `backend/.env`:

```
R2_PUBLIC_BASE_URL=https://media-dramatique.<subdomain>.workers.dev
MEDIA_TOKEN_SECRET=<the same secret>
```

Restart the backend and run `npm run check:r2` in `backend/`. Every check should pass, including
"videos are refused without a token" and "videos play with a token from this backend".

**Last step: close the back door.** In the Cloudflare dashboard, go to R2 → `dramatique-media` → Settings →
Public access → **r2.dev subdomain → Disallow**. Until then, anyone who knows the old r2.dev address can still reach the files.

## Local development

`npm run dev` runs the Worker at http://localhost:8787 against a *local* simulated bucket (`.wrangler/state`).
Put a test secret in `.dev.vars` (`MEDIA_TOKEN_SECRET=…`, gitignored). `npm test` runs the token tests.

The backend doesn't need the Worker locally: leave `MEDIA_TOKEN_SECRET` empty and it returns plain r2.dev URLs.
This only works while r2.dev access is still allowed.

## Moving to the real domain later

Add the domain to Cloudflare, then attach it to this Worker (dashboard → Workers → media-dramatique → Settings →
Domains & Routes → Add custom domain, e.g. `media.dramatique.com`). Change `R2_PUBLIC_BASE_URL` to it. No code changes are needed.
Keep `workers_dev = true` so image URLs already saved with the workers.dev address keep working.
On a custom domain, Cloudflare's CDN cache can be used for segments (cache isn't available on workers.dev).
