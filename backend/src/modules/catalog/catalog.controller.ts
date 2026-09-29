import { Request, Response } from 'express'
import * as catalog from './catalog.service'

// Public, identical for every viewer → let browsers and the CDN cache briefly
function cachePublic(res: Response, seconds = 60) {
  res.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds * 5}, stale-while-revalidate=${seconds * 10}`)
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function clampLimit(v: unknown, fallback: number, max = 100): number {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback
}

/** GET /api/v1/catalog/feed */
export async function getFeed(_req: Request, res: Response) {
  cachePublic(res)
  res.json(await catalog.getFeed())
}

/** GET /api/v1/catalog/hero */
export async function getHero(_req: Request, res: Response) {
  cachePublic(res, 300)
  res.json(await catalog.getHero())
}

/** GET /api/v1/catalog/genres */
export async function getGenres(_req: Request, res: Response) {
  cachePublic(res, 300)
  res.json(await catalog.listGenres())
}

/** GET /api/v1/catalog/series?genre=&q=&exclude=&limit= */
export async function listSeries(req: Request, res: Response) {
  const q = str(req.query.q)
  if (q && q.length > 100) return res.status(400).json({ error: 'Search query too long' })
  cachePublic(res, q ? 30 : 60)
  res.json(await catalog.listSeries({
    genre: str(req.query.genre),
    q,
    exclude: UUID_RE.test(str(req.query.exclude) ?? '') ? str(req.query.exclude) : undefined,
    limit: clampLimit(req.query.limit, 50),
  }))
}

/** GET /api/v1/catalog/series/:slug */
export async function getSeries(req: Request<{ slug: string }>, res: Response) {
  const series = await catalog.getSeriesBySlug(req.params.slug)
  if (!series) return res.status(404).json({ error: 'Series not found' })
  cachePublic(res)
  res.json(series)
}

/** GET /api/v1/catalog/series/:id/recommended?limit= */
export async function getRecommended(req: Request<{ id: string }>, res: Response) {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Series not found' })
  cachePublic(res, 300)
  res.json(await catalog.getRecommended(req.params.id, clampLimit(req.query.limit, 6, 20)))
}
