import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { HttpError } from '../../lib/http'
import { has, str, int, bool, SLUG_RE } from './validate'

type Body = Record<string, unknown>

// Categories = top-level browse groups; "subcategories" in the admin UI are
// our genres. Ids go out as strings — the admin forms compare them to
// <select> values, which are always strings.

function parseId(id: string, what: string): number {
  const n = Number(id)
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, `${what} not found`)
  return n
}

export async function listCategories() {
  const rows = await prisma.category.findMany({
    orderBy: { displayOrder: 'asc' },
    include: { _count: { select: { series: true } } },
  })
  return rows.map(c => ({
    id: String(c.id),
    name: c.name,
    slug: c.slug,
    icon: c.icon ?? '',
    color: c.color ?? '',
    description: c.description ?? '',
    display_order: c.displayOrder,
    is_active: c.isActive,
    series_count: c._count.series,
  }))
}

export async function listGenres(categoryId?: string) {
  const rows = await prisma.genre.findMany({
    where: categoryId ? { categoryId: parseId(categoryId, 'Category') } : {},
    orderBy: [{ categoryId: 'asc' }, { displayOrder: 'asc' }],
    include: { _count: { select: { series: true } } },
  })
  return rows.map(g => ({
    id: String(g.id),
    category_id: g.categoryId ? String(g.categoryId) : '',
    name: g.name,
    slug: g.slug,
    icon: g.icon ?? '',
    display_order: g.displayOrder,
    is_active: g.isActive,
    series_count: g._count.series,
  }))
}

function categoryData(body: Body, creating: boolean) {
  return {
    ...(has(body, 'name') || creating ? { name: str(body, 'name', { required: true, max: 100, label: 'Name' }) } : {}),
    ...(has(body, 'slug') || creating ? { slug: str(body, 'slug', { required: true, max: 100, pattern: SLUG_RE, label: 'Slug' }) } : {}),
    ...(has(body, 'icon') && { icon: str(body, 'icon', { max: 16 }) || null }),
    ...(has(body, 'color') && { color: str(body, 'color', { max: 16, pattern: /^#[0-9a-f]{3,8}$/i, label: 'Color' }) || null }),
    ...(has(body, 'description') && { description: str(body, 'description', { max: 255 }) || null }),
    ...(has(body, 'display_order') && { displayOrder: int(body, 'display_order', { min: 0, max: 10000 }) }),
    ...(has(body, 'is_active') && { isActive: bool(body, 'is_active') }),
  }
}

export async function createCategory(body: Body) {
  const count = await prisma.category.count()
  const row = await prisma.category.create({
    data: { displayOrder: count + 1, ...categoryData(body, true) } as Prisma.CategoryCreateInput,
  })
  return { id: String(row.id) }
}

export async function updateCategory(id: string, body: Body) {
  await prisma.category.update({ where: { id: parseId(id, 'Category') }, data: categoryData(body, false) })
  return { id }
}

export async function deleteCategory(id: string) {
  const cat = await prisma.category.findUnique({
    where: { id: parseId(id, 'Category') },
    include: { _count: { select: { genres: true, series: true } } },
  })
  if (!cat) throw new HttpError(404, 'Category not found')
  // Refuse rather than silently orphaning genres/series
  if (cat._count.genres || cat._count.series) {
    throw new HttpError(409, `Move or delete its ${cat._count.genres} subcategories and ${cat._count.series} series first`)
  }
  await prisma.category.delete({ where: { id: cat.id } })
  return { id, deleted: true }
}

async function genreData(body: Body, creating: boolean) {
  const data: Record<string, unknown> = {}
  if (has(body, 'name') || creating) data.name = str(body, 'name', { required: true, max: 100, label: 'Name' })
  if (has(body, 'slug') || creating) data.slug = str(body, 'slug', { required: true, max: 100, pattern: SLUG_RE, label: 'Slug' })
  if (has(body, 'icon')) data.icon = str(body, 'icon', { max: 16 }) || null
  if (has(body, 'display_order')) data.displayOrder = int(body, 'display_order', { min: 0, max: 10000 })
  if (has(body, 'is_active')) data.isActive = bool(body, 'is_active')
  if (has(body, 'category_id') || creating) {
    const categoryId = parseId(str(body, 'category_id', { required: true, label: 'Parent category' })!, 'Parent category')
    if (!(await prisma.category.count({ where: { id: categoryId } }))) throw new HttpError(400, 'Parent category not found')
    data.categoryId = categoryId
  }
  return data
}

export async function createGenre(body: Body) {
  const data = await genreData(body, true)
  const count = await prisma.genre.count({ where: { categoryId: data.categoryId as number } })
  const row = await prisma.genre.create({ data: { displayOrder: count + 1, ...data } as Prisma.GenreUncheckedCreateInput })
  return { id: String(row.id) }
}

export async function updateGenre(id: string, body: Body) {
  await prisma.genre.update({ where: { id: parseId(id, 'Subcategory') }, data: await genreData(body, false) })
  return { id }
}

export async function deleteGenre(id: string) {
  const genre = await prisma.genre.findUnique({
    where: { id: parseId(id, 'Subcategory') },
    include: { _count: { select: { series: true } } },
  })
  if (!genre) throw new HttpError(404, 'Subcategory not found')
  if (genre._count.series) throw new HttpError(409, `${genre._count.series} series use this subcategory — remove it from them first`)
  await prisma.genre.delete({ where: { id: genre.id } })
  return { id, deleted: true }
}
