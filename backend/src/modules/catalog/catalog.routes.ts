import { Router } from 'express'
import { getFeed, getSwipe, getHero, getGenres, listSeries, getSeries, getRecommended } from './catalog.controller'

// Public — no auth. Only live (published / schedule-reached) content is returned.
export const catalogRouter = Router()

catalogRouter.get('/feed', getFeed)
catalogRouter.get('/swipe', getSwipe)
catalogRouter.get('/hero', getHero)
catalogRouter.get('/genres', getGenres)
catalogRouter.get('/series', listSeries)
catalogRouter.get('/series/:slug', getSeries)
catalogRouter.get('/series/:id/recommended', getRecommended)
