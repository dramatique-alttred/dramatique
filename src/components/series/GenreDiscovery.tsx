'use client'

import Link from 'next/link'
import { GENRES } from '@/types'
import type { Icon } from '@phosphor-icons/react/dist/lib/types'
import { BriefcaseIcon } from '@phosphor-icons/react/dist/csr/Briefcase'
import { MoonStarsIcon } from '@phosphor-icons/react/dist/csr/MoonStars'
import { SwordIcon } from '@phosphor-icons/react/dist/csr/Sword'
import { HeartBreakIcon } from '@phosphor-icons/react/dist/csr/HeartBreak'
import { FingerprintIcon } from '@phosphor-icons/react/dist/csr/Fingerprint'
import { CastleTurretIcon } from '@phosphor-icons/react/dist/csr/CastleTurret'
import { UsersThreeIcon } from '@phosphor-icons/react/dist/csr/UsersThree'
import { ButterflyIcon } from '@phosphor-icons/react/dist/csr/Butterfly'
import { DiamondIcon } from '@phosphor-icons/react/dist/csr/Diamond'
import { MaskHappyIcon } from '@phosphor-icons/react/dist/csr/MaskHappy'

// Genre tiles with distinct gradient identities — a browsing moment mid-feed.
// Each icon sits in a tinted chip that matches its tile's gradient.
const GENRE_STYLE: Record<string, { icon: Icon; from: string; chip: string }> = {
  'CEO Romance':       { icon: BriefcaseIcon,    from: 'from-rose-900/70',    chip: 'bg-rose-400/15 text-rose-300' },
  'Supernatural':      { icon: MoonStarsIcon,    from: 'from-purple-900/70',  chip: 'bg-purple-400/15 text-purple-300' },
  'Revenge':           { icon: SwordIcon,        from: 'from-red-900/70',     chip: 'bg-red-400/15 text-red-300' },
  'Forbidden Love':    { icon: HeartBreakIcon,   from: 'from-pink-900/70',    chip: 'bg-pink-400/15 text-pink-300' },
  'Crime Thriller':    { icon: FingerprintIcon,  from: 'from-slate-800/80',   chip: 'bg-sky-400/15 text-sky-300' },
  'Fantasy':           { icon: CastleTurretIcon, from: 'from-emerald-900/70', chip: 'bg-emerald-400/15 text-emerald-300' },
  'Family Drama':      { icon: UsersThreeIcon,   from: 'from-blue-900/70',    chip: 'bg-blue-400/15 text-blue-300' },
  'Reincarnation':     { icon: ButterflyIcon,    from: 'from-indigo-900/70',  chip: 'bg-indigo-400/15 text-indigo-300' },
  'Arranged Marriage': { icon: DiamondIcon,      from: 'from-amber-900/70',   chip: 'bg-amber-400/15 text-amber-300' },
}
const FALLBACK = { icon: MaskHappyIcon, from: 'from-brand-card', chip: 'bg-white/10 text-white/80' }

export default function GenreDiscovery() {
  return (
    <section className="mb-9 px-5 md:px-8">
      <div className="flex items-baseline gap-2.5 mb-3">
        <h2 className="text-brand-bright font-bold text-base sm:text-lg tracking-tight">Browse by Mood</h2>
        <span className="text-brand-subtle text-xs hidden sm:block">Find your next obsession</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {GENRES.map(genre => {
          const s = GENRE_STYLE[genre] || FALLBACK
          const GenreIcon = s.icon
          return (
            <Link
              key={genre}
              href={`/categories?genre=${encodeURIComponent(genre)}`}
              className={`group relative h-20 rounded-xl overflow-hidden bg-gradient-to-br ${s.from} to-brand-card border border-white/5 hover:border-white/15 transition-all duration-300 ease-out-expo hover:-translate-y-0.5`}
            >
              <div className="absolute inset-0 flex items-center justify-between gap-3 px-4">
                <span className="text-white font-bold text-sm leading-tight">{genre}</span>
                <span className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-white/10 ${s.chip} group-hover:scale-110 transition-transform duration-300`}>
                  <GenreIcon size={22} weight="duotone" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
