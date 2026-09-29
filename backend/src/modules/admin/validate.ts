import { HttpError } from '../../lib/http'

// Small input guards for admin payloads. Admin forms send loosely-typed JSON
// (numbers as strings, '' for "unset"), so these coerce where it's safe and
// reject everything else with a 400 naming the field.

type Body = Record<string, unknown>

export function has(body: Body, key: string): boolean {
  return body[key] !== undefined
}

export function str(body: Body, key: string, opts: { max?: number; required?: boolean; pattern?: RegExp; label?: string } = {}): string | undefined {
  const v = body[key]
  const label = opts.label ?? key
  if (v === undefined || v === null) {
    if (opts.required) throw new HttpError(400, `${label} is required`)
    return undefined
  }
  if (typeof v !== 'string') throw new HttpError(400, `${label} must be text`)
  const s = v.trim()
  if (opts.required && !s) throw new HttpError(400, `${label} is required`)
  if (opts.max && s.length > opts.max) throw new HttpError(400, `${label} is too long (max ${opts.max})`)
  if (s && opts.pattern && !opts.pattern.test(s)) throw new HttpError(400, `${label} has an invalid format`)
  return s
}

export function int(body: Body, key: string, opts: { min?: number; max?: number; required?: boolean; label?: string } = {}): number | undefined {
  const v = body[key]
  const label = opts.label ?? key
  if (v === undefined || v === null || v === '') {
    if (opts.required) throw new HttpError(400, `${label} is required`)
    return undefined
  }
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isInteger(n)) throw new HttpError(400, `${label} must be a whole number`)
  if (opts.min !== undefined && n < opts.min) throw new HttpError(400, `${label} must be at least ${opts.min}`)
  if (opts.max !== undefined && n > opts.max) throw new HttpError(400, `${label} must be at most ${opts.max}`)
  return n
}

export function bool(body: Body, key: string): boolean | undefined {
  const v = body[key]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'boolean') throw new HttpError(400, `${key} must be true or false`)
  return v
}

// '' clears the field; otherwise must be an http(s) URL
export function url(body: Body, key: string, label = key): string | null | undefined {
  const s = str(body, key, { max: 500, label })
  if (s === undefined) return undefined
  if (!s) return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error()
  } catch {
    throw new HttpError(400, `${label} must be a valid http(s) URL`)
  }
  return s
}

export function date(body: Body, key: string, label = key): Date | null | undefined {
  const v = body[key]
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${label} must be a valid date`)
  return d
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function paging(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50))
  return { page, pageSize, skip: (page - 1) * pageSize }
}
