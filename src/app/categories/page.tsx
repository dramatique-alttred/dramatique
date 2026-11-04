'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useAllSeries } from '@/hooks'
import { GENRES } from '@/types'
import SeriesCard from '@/components/series/SeriesCard'

// Each genre gets its own mood: a gradient, a glyph, and — once a drama exists
// in that genre — its poster behind the tile
const GENRE_STYLE: Record<string, { icon: string; from: string; to: string }> = {
  'CEO Romance':       { icon: '💼', from: '#3b2a3f', to: '#12090f' },
  'Supernatural':      { icon: '🌙', from: '#1d2a44', to: '#070b14' },
  'Revenge':           { icon: '⚔️', from: '#6b0f14', to: '#14070a' },
  'Forbidden Love':    { icon: '❤️‍🔥', from: '#8a1020', to: '#18060a' },
  'Crime Thriller':    { icon: '🔍', from: '#3a3328', to: '#0d0b09' },
  'Fantasy':           { icon: '🐉', from: '#4a3a1d', to: '#0f0b05' },
  'Family Drama':      { icon: '👨‍👩‍👧', from: '#5a3a1a', to: '#120a05' },
  'Reincarnation':     { icon: '✨', from: '#5a2a0f', to: '#100804' },
  'Arranged Marriage': { icon: '💍', from: '#7a1520', to: '#14060a' },
}

// ?genre=<name> preselects a genre (home feed "See all" links)
export default function CategoriesPage({ searchParams }: { searchParams: { genre?: string } }) {
  const { data: allSeries = [] } = useAllSeries()
  const [selected, setSelected] = useState(searchParams.genre || 'All')

  const filtered = selected === 'All' ? allSeries : allSeries.filter(s => s.genre === selected)
  const posterFor = (genre: string) => allSeries.find(s => s.genre === genre)?.thumbnail_url

  return (
    <main className="min-h-screen bg-brand-black pb-24 md:pb-12">
      {/* HERO */}
      <div className="relative overflow-hidden pt-24 pb-6 px-5 md:px-8 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(229,9,20,0.35),transparent_60%)]">
        <div className="max-w-[1400px] mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-subtle mb-2">Categories</p>
          <h1 className="text-white font-black text-4xl md:text-5xl leading-[1.05] tracking-tight max-w-md">
            Find your next{' '}
            <span className="relative inline-block">
              obsession.
              <span className="absolute left-0 right-0 -bottom-1 h-[3px] rounded-full bg-brand-red" />
            </span>
          </h1>
          <p className="text-brand-subtle text-sm mt-3">Stories that keep you watching.</p>

          {/* FILTER PILLS */}
          <div className="flex gap-2 overflow-x-auto scroll-hide mt-5 -mx-5 px-5 md:mx-0 md:px-0">
            {['All', ...GENRES].map(g => (
              <button
                key={g}
                onClick={() => setSelected(g)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${selected === g ? 'bg-brand-red border-brand-red text-white' : 'border-white/15 bg-black/30 text-brand-text hover:border-white/40 hover:text-white'}`}
              >
                {g === 'All' ? 'All Genres' : g}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-5 md:px-8">
        {/* GENRE TILES */}
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5 md:gap-3 mb-10">
          {GENRES.map(genre => {
            const st = GENRE_STYLE[genre] ?? { icon: '🎭', from: '#2a2a33', to: '#0b0b0e' }
            const poster = posterFor(genre)
            const active = selected === genre
            return (
              <button
                key={genre}
                onClick={() => setSelected(active ? 'All' : genre)}
                className={`relative aspect-[3/4] rounded-xl overflow-hidden text-left border transition-all active:scale-[0.97] ${active ? 'border-brand-red ring-1 ring-brand-red' : 'border-white/10 hover:border-white/30'}`}
                style={{ background: `linear-gradient(160deg, ${st.from}, ${st.to})` }}
              >
                {poster
                  ? <Image src={poster} alt="" fill sizes="(min-width: 1024px) 12vw, 33vw" className="object-cover" />
                  : <span className="absolute right-1.5 top-1 text-4xl opacity-30 select-none">{st.icon}</span>}
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <span className="absolute left-2 bottom-2 right-2 text-white font-bold text-[13px] leading-tight drop-shadow">{genre}</span>
              </button>
            )
          })}
        </div>

        {/* RESULTS */}
        <p className="text-brand-subtle text-sm mb-4">
          <span className="text-white font-bold">{filtered.length}</span> series in{' '}
          <span className="text-brand-red font-semibold">{selected === 'All' ? 'all genres' : selected}</span>
        </p>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3 md:gap-4">
            {filtered.map(s => <SeriesCard key={s.id} series={s} size="sm" />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🎭</p>
            <p className="text-white font-bold text-xl mb-2">No series yet</p>
            <p className="text-brand-subtle text-sm">We're adding {selected} dramas soon. Check back!</p>
          </div>
        )}
      </div>
    </main>
  )
}
