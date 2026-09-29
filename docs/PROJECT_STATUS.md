# Dramatique — Project Status & Handover

_Last updated: 2026-09-29 · Branch: `phase-2-catalog-api` (not yet merged to `main`)_

Coin-based short-drama streaming web app (Netflix/JioCinema-style, 9:16 episodes).
Stack: **Next.js 14 + Tailwind** (frontend) · **Express 5 + Prisma** (backend) ·
**Supabase Postgres** · **Firebase Auth** · **Cloudflare R2** · **FFmpeg → HLS** · **Shaka Player**.

---

## 1. Decisions made (and why)

| Topic | Decision | Notes |
|---|---|---|
| App name | **Dramatique** | Early docs said "Dramatix" — treat as stale |
| Plan | 5 phases / 12 weeks (Architecture → Backend → Frontend+Player → Payments → Launch) | The user's authoritative roadmap |
| Database | **Supabase Postgres, Mumbai (ap-south-1)** | Chosen over Neon (no India region). Used as plain Postgres via Prisma only. **Data API disabled** |
| Auth | **Firebase Auth only** (Google, email link, anonymous guests) | No Firestore/Storage. Phone OTP not done yet |
| Firebase Admin | **Key-less** (project ID only) | Company Google Workspace blocks service-account key creation; token verification doesn't need one |
| Storage/CDN | **Cloudflare R2**, 2 buckets (APAC) | Zero egress fees = the main cost win for video |
| Transcoding | **FFmpeg** (swappable interface), NOT AWS MediaConvert | AWS account is the new "Builder Experience"; MediaConvert only unlocks via irreversible "Activate advanced features", which removes the $20 hard spend cap. User chose FFmpeg |
| Player | **Shaka Player** (adaptive HLS) | As per plan |
| Payments | Razorpay/Stripe — **not started** (Phase 4) | |

## 2. Accounts & infrastructure

| Service | State |
|---|---|
| **Supabase** | Project in Mumbai; migrations applied; seeded (8 series, 323 episodes, 14 genres, 4 coin packs, 2 VIP plans) |
| **Firebase** | Project `dramatique-5a322`; Anonymous + Google + Email/Password (incl. email link) enabled |
| **Cloudflare R2** | Account ID `aceb685bd9a6490eab7290db2a1274f9`; `dramatique-media` (public via r2.dev dev URL) + `dramatique-uploads` (private); CORS for `http://localhost:3000`; API token in `backend/.env`. Verify any time: `cd backend && npm run check:r2` |
| **AWS** | Account "Fresh Deploy" (new Builder Experience), Paid plan, company card, **$20 hard spend limit** + early cost controls. Not used yet |
| Admin user | `dramatix@alttrednexxus.com` has role `ADMIN` in Supabase |

**Secrets live only in** `backend/.env` and `.env.local` (both gitignored). Never commit or paste them.

## 3. What's built

### Backend (`backend/src/modules/…`)
- **auth** — verifies Firebase ID token; creates user + wallet on first sight; guests (`isGuest`) upgrade in place; suspended users blocked; welcome bonus (+10, once, idempotent) on first real login
- **catalog** (public) — `/catalog/feed | hero | genres | series?q&genre | series/:slug (with episodes) | series/:id/recommended`. Only "live" content (published, or scheduled with time passed — no cron needed). Cache headers set
- **me** (per user, guests allowed) — My List (list/ids/toggle), watch progress, continue watching, history (+clear), per-series access
- **coins** — balance, transactions, **unlock episode** (atomic: debit + unlock + ledger in one transaction; double-tap safe), **daily reward** (IST day, streak; guests blocked)
- **Coin ledger** (`coins/ledger.ts`) — the only way coins move; conditional debit so balance can't go negative; idempotency keys
- **admin** (`/admin/*`, ADMIN-only server-side) — series/episodes CRUD with validation, scheduled publishing, series lock-point + coin price re-applied to episodes only when changed; categories/genres CRUD (refuses deletes in use); users (search, guests hidden, coin adjust via ledger w/ required reason, VIP grant/revoke, ban — not self/admins); dashboard, 30-day chart (IST), top series, analytics, payment transactions; settings stored in `app_settings` (same keys the backend reads); notifications recorded (not pushed to devices)
- **video** — storage layer (`lib/storage.ts`, S3 API on R2); image upload (signed PUT, fixed type/size/immutable cache); **multipart video upload** straight from browser to private bucket; **FFmpeg transcoder** (1080/720/480/360 HLS ladder keyed on short side for 9:16, 4 s segments, aligned keyframes, progress %); DB-backed job queue that resumes after restart; versioned output paths (no CDN purge needed), old version deleted after new one is live; `GET /playback/:episodeId` decides access (free / unlocked / VIP / admin preview) and returns manifest URL + resume position

### Database (Prisma, `backend/prisma/schema.prisma`)
25 tables across UMS (users, devices, prefs, check-ins, referrals, ad views), CMS (categories, genres, series, episodes, blog), viewing (unlocks, progress, saved list), SMS (wallets, ledger, coin packs, plans, subscriptions, payment orders, webhook log), ops (notifications, app settings).
Migrations: `init`, `series_pricing_defaults` (lock point/price + backfill), `episode_transcode_progress`.

### Frontend (`src/`)
- All consumer pages on **real data**: home feed (with retry state), series detail, search (debounced server search), categories (`?genre=` preselect), My List, Continue Watching, Watch History, Transactions, Profile (daily reward + streak)
- **Guest mode**: every visitor gets an anonymous Firebase session; Google/email-link sign-in links the guest in place
- **Series page player**: Shaka `VideoPlayer`; locked → paywall; unlock → plays; no video → "coming soon"; **episode end → auto-plays next (or paywall)**; progress saved every 10 s
- **Admin panel on real data**: dashboard, series (incl. Scheduled + publish time, poster/banner URL fields), episodes, categories, users, transactions, analytics, settings, notifications; `/admin` redirects; admin login has "Continue with Google"
- Mock data files deleted (`mock-data.ts`, `admin-mock-data.ts`)
- **Admin uploads** (`src/lib/admin-upload.ts`, `components/admin/ImageUpload.tsx`, `VideoUpload.tsx`): poster/banner picker (drag-drop, straight to R2); episode video uploader (10 MB parts ×4 parallel, per-part retry, cancel → multipart abort, progress → processing % → ready preview / failed + retry). New episode → "Save & Upload Video" lands on its edit page. Duration is read-only once a video exists (FFmpeg measures it)
- Deleting an episode/series also removes its R2 files (HLS, raw source, images)
- `apiClient` waits for Firebase to restore the session before sending requests (direct loads of admin pages used to 401)
- **Video URL protection built, not deployed**: `workers/media` Worker + signed URLs (`backend/src/lib/media-token.ts`). Deploy steps: `workers/media/README.md` (needs `wrangler login` by the user)
- **Hosting prepared**: `backend/Dockerfile` (Node 22 + FFmpeg), multi-origin CORS, graceful shutdown, GitHub Actions checks. Plan: API on **DigitalOcean App Platform, Bangalore**, website on Vercel. Steps: `docs/DEPLOY.md`

### Demo content
*Forbidden CEO* episodes **1, 2 (free) and 7 (locked)** have 30-second demo videos (labelled test pattern) transcoded to HLS on R2.

### Tested
Backend flows were tested end-to-end against real Supabase/R2 with throwaway users (guest/coins/races: 18 checks; admin: 58 checks; video pipeline: 24 checks) — all passing, test data cleaned up. Playback + binge loop verified in the browser.

## 4. What's NOT done yet (next steps, in order)

1. **Protect video URLs** — currently the HLS URLs on r2.dev are public if shared. Needs: own domain (e.g. `media.dramatique.com`) on Cloudflare → R2 custom domain → Cloudflare Worker validating short-lived signed tokens issued by `/playback`; Shaka request filter to append the token. **Needs a domain** (not decided yet)
2. **Redis** for watch-progress hot writes (plan: sync across devices within 2 s)
3. **Onboarding genre picker** (UX flow step 1; `user_genre_preferences` table exists) + personalised feed
4. **Phone OTP** login (needs Firebase billing)
5. **Phase 4 — Payments**: Razorpay (coin packs + VIP), secure webhooks → ledger/subscriptions; connect admin **Plans** page (still sample data); VIP subscriptions
6. **Referrals** (invite rewards), **rewarded ads** (AdMob), **push notifications** (FCM)
7. **Blog** admin/site (still sample data; not in plan)
8. **Phase 5**: deploy (backend + FFmpeg worker in Mumbai, Next.js), production CORS origins, R2 custom domain, monitoring, load testing, UAT on Jio/Airtel/Vi
9. Merge branch `phase-2-catalog-api` → `main` when happy

## 5. How to run locally

Two terminals (both must be running):
```
cd E:/draamatique/backend && npm run dev     # API on :4000
cd E:/draamatique && npm run dev             # website on :3000
```
Useful backend scripts: `npm run db:deploy` · `npm run db:seed` · `npm run db:studio` · `npm run check:r2` · `npm run typecheck`.
FFmpeg must be on PATH (it is, via WinGet). If the home page says "Couldn't load dramas", the backend isn't running.

## 6. Known quirks
- `prisma generate` may print an EPERM rename error while the backend is running (Windows file lock on the engine DLL) — types still generate; restart the backend to be safe after schema changes.
- In the in-app terminal, background servers started by Claude stop when its session ends — run servers in your own terminals.
- AWS console defaults to Sydney; region doesn't matter until advanced features are activated (not planned).
