import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

interface Lite { slug?: string; title?: string; genre?: string }

/**
 * Plain text that is in the page's HTML before any script runs, so crawlers and
 * link previews see real content. It is visually hidden: the interface itself is
 * unchanged. Refreshed hourly together with the catalog.
 */
export default async function SeoIntro() {
  let series: Lite[] = []
  try {
    const res = await fetch(`${API}/catalog/series`, { next: { revalidate: 3600 } })
    if (res.ok) {
      const body = await res.json()
      series = (Array.isArray(body) ? body : body?.data ?? []) as Lite[]
    }
  } catch { /* API unreachable: the static text below still renders */ }

  return (
    <aside className="sr-only" aria-label="About Dramatique">
      <h2>Dramatique: short dramas, big emotions, endless stories</h2>
      <p>
        Dramatique is a streaming app for vertical short dramas. Watch full series in quick episodes made for your phone,
        from CEO romance and supernatural love stories to revenge, crime thrillers, fantasy, family drama,
        reincarnation and arranged marriage. Many dramas are free to start, with new episodes added every week.
        Install Dramatique on your home screen for full-screen viewing, daily rewards and instant access to your list.
      </p>
      {series.length > 0 && (
        <nav aria-label="Dramas on Dramatique">
          <p>Dramas on Dramatique:</p>
          <ul>
            {series.slice(0, 20).map(s => s.slug && (
              <li key={s.slug}>
                <Link href={`/series/${s.slug}`}>{s.title}{s.genre ? ` — ${s.genre}` : ''}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
  )
}
