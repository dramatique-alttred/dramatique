'use client'

import { useSeriesFeed, useHeroSeries, useContinueWatching } from '@/hooks'
import HeroBanner from '@/components/series/HeroBanner'
import SeriesRow from '@/components/series/SeriesRow'
import GenreDiscovery from '@/components/series/GenreDiscovery'

// Row ids come from the backend feed (/catalog/feed); genre rows are "genre-<slug>"
const SEE_ALL: Record<string, string> = {
  trending: '/new-hot',
  new: '/new-hot',
  vip: '/vip',
  'top-rated': '/new-hot',
}
const seeAllFor = (id: string, title: string) =>
  SEE_ALL[id] ?? (id.startsWith('genre-') ? `/categories?genre=${encodeURIComponent(title)}` : undefined)

export default function HomePage() {
  const { data: feed, isLoading: feedLoading, isFetching: feedFetching, refetch: refetchFeed } = useSeriesFeed()
  const { data: heroSeries, isLoading: heroLoading, refetch: refetchHero } = useHeroSeries()
  const { data: continueWatching } = useContinueWatching()

  return (
    <main className="min-h-screen bg-brand-black">
      <HeroBanner series={heroSeries || []} loading={heroLoading} />

      <div className="pb-24 md:pb-12 relative z-10 -mt-8 md:-mt-16">
        {/* Continue Watching leads — the fastest path back into the product */}
        {continueWatching && continueWatching.length > 0 && (
          <SeriesRow
            title="Continue Watching"
            subtitle="Pick up where you left off"
            kind="continue"
            series={continueWatching}
          />
        )}

        {/* No data and nothing in flight = failed or paused (e.g. API
            unreachable) — never leave the user on a blank page */}
        {!feed && !feedFetching && (
          <div className="flex flex-col items-center justify-center text-center py-24 px-4">
            <div className="text-5xl mb-4">📡</div>
            <h2 className="text-white font-bold text-xl mb-2">Couldn&apos;t load dramas</h2>
            <p className="text-brand-subtle text-sm mb-6 max-w-xs">Check your connection and try again.</p>
            <button onClick={() => { refetchFeed(); refetchHero() }} className="btn-primary px-8 py-3">Try Again</button>
          </div>
        )}

        {feedLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <SeriesRow key={i} title="" series={[]} loading={true} />
            ))
          : feed?.map((section, idx) => (
              <div key={section.id}>
                <SeriesRow
                  title={section.title}
                  subtitle={section.subtitle}
                  kind={section.kind}
                  series={section.series}
                  seeAllHref={seeAllFor(section.id, section.title)}
                />
                {/* Genre discovery injected mid-feed for browsing variety */}
                {idx === 1 && <GenreDiscovery />}
              </div>
            ))
        }
      </div>
    </main>
  )
}
