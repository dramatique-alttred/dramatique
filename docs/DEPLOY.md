# Deploying Dramatique

| Piece | Where | Deploys from |
|---|---|---|
| Website (Next.js) | Vercel | GitHub, on push |
| API + FFmpeg (`backend/`) | DigitalOcean App Platform, **Bangalore** | GitHub, on push (`backend/Dockerfile`) |
| Video gatekeeper (`workers/media/`) | Cloudflare Workers | `npx wrangler deploy` (see `workers/media/README.md`) |
| Database | Supabase, Mumbai | migrations: `cd backend && npm run db:deploy` |
| Files | Cloudflare R2 | — |

GitHub Actions (`.github/workflows/checks.yml`) type-checks everything and builds and boots the API image on every push.
If it's red, fix that before deploying.

---

## 1. API on DigitalOcean

1. **Create → Apps → GitHub**, then pick `dramatique-alttred/dramatique`.
   - Branch: `phase-2-catalog-api` for now (switch to `main` after the merge). Keep **Autodeploy** on.
   - **Source directory: `backend`**. DigitalOcean detects the Dockerfile.
2. **Resource settings**
   - Type: Web Service · HTTP port **8080** · Health check path **`/health`**
   - Size: **at least 2 GB RAM**. FFmpeg makes four qualities at once; 1 GB can run out of memory on 1080p.
   - **Instances: exactly 1.** The video queue runs inside the API process, and a second instance would process the same videos twice.
     (Scaling up later means moving the queue to a separate worker first.)
3. **Region: Bangalore (BLR)**, the closest to the Supabase database in Mumbai.
4. **Environment variables** (mark all as *Encrypted*). Copy the values from `backend/.env`:

   | Name | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Supabase pooler URL (port 6543) |
   | `DIRECT_URL` | Supabase direct URL (port 5432) |
   | `FIREBASE_PROJECT_ID` | `dramatique-5a322` |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | from `backend/.env` |
   | `R2_MEDIA_BUCKET` / `R2_UPLOADS_BUCKET` | `dramatique-media` / `dramatique-uploads` |
   | `R2_PUBLIC_BASE_URL` | r2.dev URL now; the Worker URL once it's deployed |
   | `MEDIA_TOKEN_SECRET` | empty now; the Worker secret once it's deployed |
   | `CORS_ORIGIN` | `https://dramatique-shorts.vercel.app,https://dramatique-*-dramatique-team.vercel.app` (plus any other domain the site uses) |

   Don't set `PORT`; the image uses 8080.
5. Create the app. When the build finishes, open `https://<app>.ondigitalocean.app/health` and check it shows `{"status":"ok"}`.

The API URL for the website is `https://<app>.ondigitalocean.app/api/v1`.

Database changes aren't applied automatically. Before deploying code that includes a new migration, run
`cd backend && npm run db:deploy` from your computer.

## 2. Website on Vercel

Project → Settings → Environment Variables. Add these for **Production and Preview**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<app>.ondigitalocean.app/api/v1` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | from `.env.local` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | from `.env.local` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | from `.env.local` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | from `.env.local` |

`NEXT_PUBLIC_*` values are built into the site, so **redeploy** after changing them (Deployments → ⋯ → Redeploy).

## 3. Firebase sign-in on the new domains

Firebase console → Authentication → Settings → **Authorized domains → Add domain**:
`dramatique-shorts.vercel.app`, plus the branch preview domain you test on
(e.g. `dramatique-git-phase-2-catalog-api-dramatique-team.vercel.app`). Google sign-in refuses unlisted domains.
Guest mode works without this.

## 4. R2 upload permissions (CORS) for the new domains

The admin panel uploads posters and videos straight from the browser to R2, so both buckets must allow the site.
Cloudflare dashboard → R2 → *bucket* → Settings → **CORS policy → Edit**. Use this for **both** `dramatique-media` and `dramatique-uploads`:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://dramatique-shorts.vercel.app",
      "https://dramatique-git-phase-2-catalog-api-dramatique-team.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

`ExposeHeaders: ETag` is required: multipart video uploads fail without it.
(R2 matches origins exactly, so add each domain that uploads.)

## 5. Go live

1. Test the Vercel **preview** of `phase-2-catalog-api`: browse, sign in, watch a free episode, unlock a paid one, and in the admin panel upload a poster and a video.
2. Merge the branch into `main` on GitHub. Vercel then publishes the live site.
3. In DigitalOcean, switch the app's branch to `main`.
