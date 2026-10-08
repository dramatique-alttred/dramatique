'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Search, X, Clock, ArrowRight, Loader2 } from '@/components/ui/icons'
import { useSeriesSearch } from '@/hooks'

const TRENDING = ['CEO Romance', 'Revenge', 'Werewolf', 'Billionaire', 'Forbidden', 'Dragon']
const RECENT_KEY = 'dq.recentSearches'
const MAX_RESULTS = 6

function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function pushRecent(q: string) {
  try {
    const next = [q, ...readRecent().filter(r => r.toLowerCase() !== q.toLowerCase())].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch { /* storage blocked */ }
}

/** Navbar search: results appear as you type; ↑ ↓ to move, Enter to open */
export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => { inputRef.current?.focus(); setRecent(readRecent()) }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200)
    return () => clearTimeout(t)
  }, [query])

  const { data, isFetching } = useSeriesSearch(debounced)
  const results = debounced ? (data ?? []).slice(0, MAX_RESULTS) : []
  const typing = query.trim() !== debounced || (isFetching && !!debounced)

  useEffect(() => { setHighlight(-1) }, [debounced])

  const openSeries = (slug: string) => {
    if (query.trim()) pushRecent(query.trim())
    onClose()
    router.push(`/series/${slug}`)
  }
  const seeAll = (q = query.trim()) => {
    if (!q) return
    pushRecent(q)
    onClose()
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, -1)) }
    else if (e.key === 'Enter') {
      if (highlight >= 0 && results[highlight]) openSeries(results[highlight].slug)
      else seeAll()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-start justify-center pt-16 sm:pt-24 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 bg-brand-card border border-brand-border rounded-2xl px-5 py-4 focus-within:border-brand-muted transition-colors">
          {typing ? <Loader2 size={20} className="text-brand-subtle flex-shrink-0 animate-spin" /> : <Search size={20} className="text-white flex-shrink-0" />}
          <input
            ref={inputRef} type="text" value={query}
            onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search series, genres, stories..."
            aria-label="Search"
            className="flex-1 bg-transparent text-white placeholder-brand-muted text-lg outline-none"
          />
          <button onClick={onClose} aria-label="Close search" className="text-brand-subtle hover:text-white"><X size={20} /></button>
        </div>

        <div className="mt-2 bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
          {!debounced ? (
            <div className="p-4 space-y-4">
              {recent.length > 0 && (
                <div>
                  <p className="text-brand-subtle text-[11px] uppercase tracking-widest font-semibold mb-2">Recent</p>
                  <div className="flex flex-col">
                    {recent.map(r => (
                      <button key={r} onClick={() => setQuery(r)} className="flex items-center gap-2.5 text-left text-brand-text hover:text-white text-sm py-1.5">
                        <Clock size={14} className="text-brand-muted" /> {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-brand-subtle text-[11px] uppercase tracking-widest font-semibold mb-2">Trending</p>
                <div className="flex flex-wrap gap-2">
                  {TRENDING.map(t => (
                    <button key={t} onClick={() => setQuery(t)} className="text-xs text-brand-text border border-brand-border hover:border-brand-red hover:text-white rounded-full px-3 py-1.5 transition-colors">
                      🔥 {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : results.length === 0 ? (
            <p className="p-6 text-center text-brand-subtle text-sm">
              {typing ? 'Searching…' : <>No dramas match &ldquo;{debounced}&rdquo;. Try a genre like <button onClick={() => setQuery('Revenge')} className="text-brand-red font-semibold">Revenge</button>.</>}
            </p>
          ) : (
            <>
              <ul role="listbox">
                {results.map((s, i) => (
                  <li key={s.id} role="option" aria-selected={i === highlight}>
                    <Link
                      href={`/series/${s.slug}`}
                      onClick={e => { e.preventDefault(); openSeries(s.slug) }}
                      onMouseEnter={() => setHighlight(i)}
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${i === highlight ? 'bg-brand-dark' : ''}`}
                    >
                      <div className="relative w-10 h-14 rounded-md overflow-hidden flex-shrink-0 bg-brand-dark">
                        <Image src={s.thumbnail_url} alt="" fill sizes="40px" className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{s.title}</p>
                        <p className="text-brand-subtle text-xs truncate">{s.genre} · {s.total_episodes} episodes · {s.language}</p>
                      </div>
                      {s.lock_from_episode > 1 && <span className="text-green-400 text-[10px] font-semibold flex-shrink-0">Free to Ep {s.lock_from_episode - 1}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              <button onClick={() => seeAll()} className="w-full flex items-center justify-center gap-1.5 border-t border-brand-border py-3 text-sm text-brand-subtle hover:text-white transition-colors">
                See all results for &ldquo;{debounced}&rdquo; <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>
        <p className="hidden sm:block text-center text-brand-muted text-[11px] mt-3">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  )
}
