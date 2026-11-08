import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getClusters, getSessions } from '@/api'
import { formatDuration } from '@/lib/format'
import { WIDTH, HEIGHT, makeScale, starRadius, constellationLines, centroid } from '@/lib/starchart'
import StarSymbol, { CATEGORIES } from '@/components/StarSymbol'
import Frame from '@/components/Frame'

export default function StarChart() {
  const [sessions, setSessions] = useState(null)
  const [clusters, setClusters] = useState(null)
  const [error, setError] = useState(null)
  const [hovered, setHovered] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([getSessions(), getClusters()])
      .then(([s, c]) => {
        setSessions(s)
        setClusters(c)
      })
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <p className="text-destructive">Lost signal: {error}</p>
  if (!sessions || !clusters) return <p className="text-muted-foreground">Charting the sky…</p>

  const scale = makeScale(sessions)
  const categoryOf = (clusterId) => clusters.find((c) => c.id === clusterId)?.category ?? 'unknown'

  // Every session with a position becomes a star with screen coordinates
  const stars = sessions
    .filter((s) => s.position)
    .map((s) => ({ ...s, ...scale(s.position), r: starRadius(s.duration_s) }))

  return (
    <Frame title="Star Chart" fill>
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
                  {cluster.name}
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
                faint={!s.cluster_id}
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
              {hovered.cluster_id ? CATEGORIES[categoryOf(hovered.cluster_id)] : 'Uncharted'} · trapped {formatDuration(hovered.duration_s)}
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
