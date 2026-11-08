import { Link } from 'react-router'
import { getClusters, getIocs, getSessions, getStats } from '@/api'
import { catalogueId, formatDuration, timeAgo } from '@/lib/format'
import usePolling from '@/lib/usePolling'
import BlackHole from '@/components/BlackHole'
import StarSymbol from '@/components/StarSymbol'
import Frame from '@/components/Frame'
import PageLoader from '@/components/PageLoader'

export default function Horizon() {
  const { data, error } = usePolling(async () => {
    const [sessions, clusters, iocs, stats] = await Promise.all([
      getSessions(),
      getClusters(),
      getIocs(),
      getStats(),
    ])
    return { sessions, clusters, iocs, stats }
  })

  if (!data && error) return <p className="text-destructive">Lost signal: {error}</p>
  if (!data) return <PageLoader />

  const { sessions, clusters, iocs, stats } = data
  const canShowDilation =
    Number.isFinite(stats.baseline_avg_s) &&
    stats.baseline_avg_s > 0 &&
    Number.isFinite(stats.avg_engaged_s)
  const dilation = canShowDilation ? Math.round(stats.avg_engaged_s / stats.baseline_avg_s) : null
  const newestIocs = [...iocs]
    .sort((a, b) =>
      (b.last_seen ?? b.first_seen ?? '').localeCompare(a.last_seen ?? a.first_seen ?? ''),
    )
    .slice(0, 5)

  return (
    <Frame title="The Horizon">
      {error && <p className="mb-4 text-sm text-destructive">Lost signal: {error}</p>}
      <div className="grid items-center gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* The black hole */}
        <section>
          <BlackHole sessions={sessions} />
        </section>

        {/* Readouts */}
        <aside className="min-w-0 space-y-8">
          {canShowDilation && (
            <div>
              <Label>Time dilation</Label>
              <div className="mt-1 font-display text-7xl italic text-live">{dilation}×</div>
              <div className="mt-4 grid grid-cols-2 border-t border-border pt-3 font-mono text-sm">
                <div>
                  <Label>Ordinary</Label>
                  {formatDuration(stats.baseline_avg_s)}
                </div>
                <div>
                  <Label>Event Horizon</Label>
                  <span className="text-live">{formatDuration(stats.avg_engaged_s)}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Constellations</Label>
            <ul className="mt-2">
              {clusters.map((c) => (
                <li key={c.id}>
                  <Link to="/chart" className="flex items-center gap-3 border-b border-border/50 py-2 hover:text-live">
                    <svg width="14" height="14" className="shrink-0 overflow-visible">
                      <StarSymbol category={c.category ?? 'unknown'} x={7} y={7} r={5} />
                    </svg>
                    <span className="min-w-0 truncate font-display text-lg italic">{c.name ?? c.label ?? c.id}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{c.session_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Latest attackers */}
        <section>
          <div className="flex items-baseline justify-between">
            <Label>Recent sightings</Label>
            <Link to="/transmissions" className="text-xs text-muted-foreground hover:text-foreground">All →</Link>
          </div>
          <ul className="mt-2">
            {sessions.slice(0, 5).map((s) => (
              <li key={s.id}>
                <Link
                  to={`/transmissions/${s.id}`}
                  className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[90px_minmax(0,1fr)_auto] border-b border-border/50 py-2 font-mono text-sm hover:bg-card"
                >
                  <span className={s.status === 'active' ? 'text-live' : 'text-muted-foreground'}>
                    {s.status === 'active' ? '● ' : ''}{catalogueId(s.id)}
                  </span>
                  <span className="truncate">{s.src_ip}</span>
                  <span className="text-xs text-muted-foreground max-sm:hidden">{timeAgo(s.started_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Latest indicators */}
        <section>
          <Label>Newest indicators</Label>
          <ul className="mt-2">
            {newestIocs.map((i) => (
              <li key={i.id} className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-4 border-b border-border/50 py-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{i.type.replace('_', ' ')}</span>
                <span className="truncate font-mono text-sm">{i.value}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Frame>
  )
}

function Label({ children }) {
  return <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{children}</div>
}
