import { useState } from 'react'
import { useNavigate } from 'react-router'
import { getClusters, getSessions } from '@/api'
import { formatDuration } from '@/lib/format'
import usePolling from '@/lib/usePolling'
import { WIDTH, HEIGHT, makeScale, starRadius, constellationLines, centroid, timelineLayout } from '@/lib/starchart'
import StarSymbol, { CATEGORIES } from '@/components/StarSymbol'
import Frame from '@/components/Frame'
import PageLoader from '@/components/PageLoader'

export default function StarChart() {
  const [hovered, setHovered] = useState(null)
  const navigate = useNavigate()

  const { data, error } = usePolling(async () => {
    const [sessions, clusters] = await Promise.all([getSessions(), getClusters()])
    return { sessions, clusters }
  })

  if (!data && error) return <p className="text-destructive">Lost signal: {error}</p>
  if (!data) return <PageLoader />

  const { sessions, clusters } = data
  const categoryOf = (clusterId) => clusters.find((c) => c.id === clusterId)?.category ?? 'unknown'

  // Use the ML's coordinates when it has supplied them. Until then, lay the sky out
  // as a timeline: across = when the session started, up = its worst severity.
  const usingMl = sessions.some((s) => s.position)
  const timeline = usingMl ? null : timelineLayout(sessions)
  const scale = usingMl ? makeScale(sessions) : null
  const stars = sessions
    .filter((s) => (usingMl ? s.position : true))
    .map((s) => ({
      ...s,
      ...(usingMl ? scale(s.position) : timeline.place(s)),
      r: starRadius(s.duration_s ?? 0),
    }))
  // Without ML clusters every star is "uncharted", so only dim them once clusters exist
  const dimUnclustered = clusters.length > 0

  return (
    <Frame
      title="Star Chart"
      caption={
        usingMl || stars.length === 0
          ? undefined
          : 'Plotted by when each attacker arrived (across) and the most severe command they ran (up), until the ML maps them by behaviour.'
      }
      fill
    >
      {error && <p className="mb-2 text-sm text-destructive">Lost signal: {error}</p>}
      {/* Take the leftover height; the chart scales to fit it without scrolling */}
      <div className="flex min-h-60 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
      <div
        className="relative border border-border"
        style={{ width: `min(100cqw, 100cqh * ${WIDTH / HEIGHT})`, aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-full w-full">
          {/* Faint grid, like an atlas */}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1={(i + 1) * 100} y1={0} x2={(i + 1) * 100} y2={HEIGHT} stroke="var(--border)" strokeWidth={0.5} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={(i + 1) * 91} x2={WIDTH} y2={(i + 1) * 91} stroke="var(--border)" strokeWidth={0.5} />
          ))}

          {/* Timeline axes, only when there are no ML coordinates */}
          {timeline && stars.length > 0 && (
            <g className="font-mono text-[11px] uppercase tracking-widest">
              {timeline.rows.map((row) => (
                <text key={row.label} x={12} y={row.y + 4} className="fill-muted-foreground">
                  {row.label}
                </text>
              ))}
              {timeline.ticks.map((tick, i) => (
                <text key={i} x={tick.x} y={HEIGHT - 16} textAnchor="middle" className="fill-muted-foreground">
                  {tick.label}
                </text>
              ))}
            </g>
          )}

          {stars.length === 0 && (
            <text
              x={WIDTH / 2}
              y={HEIGHT / 2}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-sm"
            >
              No attackers sighted yet.
            </text>
          )}

          {/* Constellations: lines + name */}
          {clusters.map((cluster) => {
            const members = stars.filter((s) => s.cluster_id === cluster.id)
            if (members.length === 0) return null
            const center = centroid(members)
            const top = Math.min(...members.map((m) => m.y))
            return (
              <g key={cluster.id}>
                {constellationLines(members).map(([a, b], i) => (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={1} />
                ))}
                <text x={center.x} y={top - 28} textAnchor="middle" className="fill-foreground font-display text-[22px] italic">
                  {cluster.name ?? cluster.label ?? cluster.id}
                </text>
                <text x={center.x} y={top - 12} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px] uppercase tracking-widest">
                  {CATEGORIES[cluster.category] ?? 'Unknown'} · {members.length} sightings
                </text>
              </g>
            )
          })}

          {/* Stars */}
          {stars.map((s) => (
            <g
              key={s.id}
              className="cursor-pointer"
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => navigate(`/transmissions/${s.id}`)}
            >
              {/* Invisible bigger circle so small stars are easy to hover */}
              <circle cx={s.x} cy={s.y} r={Math.max(s.r * 2, 12)} fill="transparent" />
              <StarSymbol
                category={s.cluster_id ? categoryOf(s.cluster_id) : 'unknown'}
                x={s.x}
                y={s.y}
                r={s.r}
                active={s.status === 'active'}
                faint={dimUnclustered && !s.cluster_id}
              />
            </g>
          ))}
        </svg>

        {/* Hover info, in plain English */}
        {hovered && (
          <div
            className="pointer-events-none absolute border border-border bg-card px-4 py-3 font-mono text-xs"
            style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%`, transform: 'translate(16px, 16px)' }}
          >
            <div className="text-sm text-foreground">{hovered.src_ip}</div>
            <div className="text-muted-foreground">
              {hovered.cluster_id ? (CATEGORIES[categoryOf(hovered.cluster_id)] ?? 'Unknown') : 'Uncharted'} · trapped {formatDuration(hovered.duration_s)}
            </div>
            {hovered.status === 'active' && <div className="text-live">● still connected</div>}
          </div>
        )}

      </div>
      </div>

      <Legend />
    </Frame>
  )
}

function Legend() {
  return (
    <div className="mt-3 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border border-border px-4 py-3 text-xs">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Legend</span>
      {Object.entries(CATEGORIES).map(([key, label]) => (
        <span key={key} className="flex items-center gap-2">
          <svg width="14" height="14" className="overflow-visible">
            <StarSymbol category={key} x={7} y={7} r={5} />
          </svg>
          {label}
        </span>
      ))}
      <span className="text-muted-foreground">Bigger = trapped longer</span>
      <span className="text-live">Amber = still connected</span>
    </div>
  )
}
