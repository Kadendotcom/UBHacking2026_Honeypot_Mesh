import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { getClusters, getSessions } from '@/api'
import { formatDuration } from '@/lib/format'
import usePolling from '@/lib/usePolling'
import {
  HEIGHT,
  chartWidth,
  makeScale,
  starRadius,
  constellationLines,
  attackerTrails,
  centroid,
  timelineLayout,
} from '@/lib/starchart'
import StarSymbol, { CATEGORIES } from '@/components/StarSymbol'
import Frame from '@/components/Frame'
import PageLoader from '@/components/PageLoader'

// Pixel size of an element, kept up to date as the window resizes
function useBoxSize() {
  const ref = useRef(null)
  const [size, setSize] = useState(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  })
  return [ref, size]
}

export default function StarChart() {
  const [hovered, setHovered] = useState(null)
  const navigate = useNavigate()
  const [boxRef, box] = useBoxSize()

  const { data, error } = usePolling(async () => {
    const [sessions, clusters] = await Promise.all([getSessions(), getClusters()])
    return { sessions, clusters }
  })

  if (!data && error) return <p className="text-destructive">Lost signal: {error}</p>
  if (!data) return <PageLoader />

  const { sessions, clusters } = data
  const categoryOf = (clusterId) => clusters.find((c) => c.id === clusterId)?.category ?? 'unknown'
  const starCategory = (s) => (s.cluster_id ? categoryOf(s.cluster_id) : 'unknown')

  // The sky is as wide as the box it sits in, so there are no empty bands at the sides
  const W = chartWidth(box?.width, box?.height)

  // Use the ML's coordinates when it has supplied them. Until then, lay the sky out
  // as a timeline: across = when the session started, up = its worst severity.
  const usingMl = sessions.some((s) => s.position)
  const timeline = usingMl ? null : timelineLayout(sessions, W)
  const scale = usingMl ? makeScale(sessions, W) : null
  const stars = sessions
    .filter((s) => (usingMl ? s.position : true))
    .map((s) => ({
      ...s,
      ...(usingMl ? scale(s.position) : timeline.place(s)),
      r: starRadius(s.duration_s ?? 0),
    }))

  // Two kinds of constellation:
  //  - ML clusters: attackers that behave alike (named, drawn as a spanning tree)
  //  - trails: one IP coming back several times, joined in time order. Only for stars
  //    the ML hasn't put in a cluster, so a star never belongs to both.
  const constellations = clusters
    .map((cluster) => ({ cluster, members: stars.filter((s) => s.cluster_id === cluster.id) }))
    .filter((c) => c.members.length > 0)
  const trails = attackerTrails(stars.filter((s) => !s.cluster_id))

  // Without ML clusters every star is unclassified, so only dim them once clusters exist
  const dimUnclustered = clusters.length > 0

  const hoverLeft = hovered && hovered.x > W * 0.7
  const hoverUp = hovered && hovered.y > HEIGHT * 0.7

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
      {/* Take the leftover height and the full width; the chart's width follows the box */}
      <div ref={boxRef} className="flex min-h-60 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
        <div
          className="relative border border-border"
          style={{ width: `min(100cqw, 100cqh * ${W / HEIGHT})`, aspectRatio: `${W} / ${HEIGHT}` }}
        >
          <svg viewBox={`0 0 ${W} ${HEIGHT}`} className="block h-full w-full">
            {/* Faint grid, like an atlas */}
            {Array.from({ length: Math.floor(W / 100) }, (_, i) => (
              <line key={`v${i}`} x1={(i + 1) * 100} y1={0} x2={(i + 1) * 100} y2={HEIGHT} stroke="var(--border)" strokeWidth={0.5} />
            ))}
            {Array.from({ length: 6 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={(i + 1) * 91} x2={W} y2={(i + 1) * 91} stroke="var(--border)" strokeWidth={0.5} />
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
              <text x={W / 2} y={HEIGHT / 2} textAnchor="middle" className="fill-muted-foreground font-mono text-sm">
                No attackers sighted yet.
              </text>
            )}

            {/* Trails: a returning attacker, joined in the order they visited */}
            {trails.map((trail) => {
              const first = trail.members[0]
              return (
                <g key={trail.ip}>
                  {trail.lines.map(([a, b], i) => (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="var(--foreground)"
                      strokeOpacity={0.25}
                      strokeWidth={1}
                      strokeDasharray="3 4"
                    />
                  ))}
                  <text
                    x={first.x}
                    y={first.y - first.r - 10}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono text-[10px] tracking-widest"
                  >
                    {trail.ip} · {trail.members.length} visits
                  </text>
                </g>
              )
            })}

            {/* ML constellations: lines + name */}
            {constellations.map(({ cluster, members }) => {
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
                    {CATEGORIES[cluster.category] ?? CATEGORIES.unknown} · {members.length} sightings
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
                  category={starCategory(s)}
                  x={s.x}
                  y={s.y}
                  r={s.r}
                  active={s.status === 'active'}
                  faint={dimUnclustered && !s.cluster_id}
                />
              </g>
            ))}
          </svg>

          {/* Hover info, in plain English. Flips to stay inside the chart near the edges. */}
          {hovered && (
            <div
              className="pointer-events-none absolute z-10 whitespace-nowrap border border-border bg-card px-4 py-3 font-mono text-xs"
              style={{
                left: `${(hovered.x / W) * 100}%`,
                top: `${(hovered.y / HEIGHT) * 100}%`,
                transform: `translate(${hoverLeft ? 'calc(-100% - 16px)' : '16px'}, ${hoverUp ? 'calc(-100% - 16px)' : '16px'})`,
              }}
            >
              <div className="text-sm text-foreground">{hovered.src_ip}</div>
              <div className="text-muted-foreground">
                {CATEGORIES[starCategory(hovered)] ?? CATEGORIES.unknown} · trapped {formatDuration(hovered.duration_s)}
              </div>
              {hovered.status === 'active' && <div className="text-live">● still connected</div>}
            </div>
          )}
        </div>
      </div>

      <Legend
        categories={[...new Set(stars.map(starCategory))]}
        hasStars={stars.length > 0}
        hasActive={stars.some((s) => s.status === 'active')}
        hasTrails={trails.length > 0}
        hasConstellations={constellations.length > 0}
      />
    </Frame>
  )
}

// Always at the bottom. Once there are stars it only explains what's on the chart;
// on an empty sky it shows every symbol as a key for what's to come.
function Legend({ categories, hasStars, hasActive, hasTrails, hasConstellations }) {
  const shown = hasStars ? Object.keys(CATEGORIES).filter((key) => categories.includes(key)) : Object.keys(CATEGORIES)

  return (
    <div className="mt-3 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border border-border px-4 py-3 text-xs">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Legend</span>
      {shown.map((key) => (
        <span key={key} className="flex items-center gap-2">
          <svg width="14" height="14" className="overflow-visible">
            <StarSymbol category={key} x={7} y={7} r={5} />
          </svg>
          {CATEGORIES[key]}
        </span>
      ))}
      {hasConstellations && (
        <span className="flex items-center gap-2">
          <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--foreground)" strokeOpacity={0.6} /></svg>
          Constellation = similar behaviour
        </span>
      )}
      {hasTrails && (
        <span className="flex items-center gap-2">
          <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--foreground)" strokeOpacity={0.6} strokeDasharray="3 3" /></svg>
          Same attacker returning
        </span>
      )}
      <span className="text-muted-foreground">Bigger = trapped longer</span>
      {(hasActive || !hasStars) && <span className="text-live">Amber = still connected</span>}
    </div>
  )
}
