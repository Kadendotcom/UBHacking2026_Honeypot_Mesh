// Pure math for the star chart. No React here, so it's easy to test.

export const WIDTH = 1000
export const HEIGHT = 640
const PADDING = 80

// The ML gives positions on any scale (e.g. -3 to 3). Stretch them to fit the SVG.
export function makeScale(sessions) {
  const placed = sessions.filter((s) => s.position)
  const xs = placed.map((s) => s.position.x)
  const ys = placed.map((s) => s.position.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)

  return (position) => ({
    x: PADDING + ((position.x - minX) / (maxX - minX || 1)) * (WIDTH - 2 * PADDING),
    // SVG's y axis points down, so flip it so "up" in the data is up on screen
    y: PADDING + ((maxY - position.y) / (maxY - minY || 1)) * (HEIGHT - 2 * PADDING),
  })
}

// "Magnitude": longer time trapped = bigger star. Square root so one very long
// session doesn't make every other star look tiny.
export function starRadius(durationSeconds) {
  return 3 + Math.sqrt(durationSeconds) * 0.35
}

// Minimum spanning tree with Prim's algorithm: connects every point using the
// shortest total line length, so it looks like a constellation, not a web.
export function constellationLines(points) {
  if (points.length < 2) return []
  const inTree = [points[0]]
  const remaining = points.slice(1)
  const lines = []

  while (remaining.length > 0) {
    let best = null
    for (const a of inTree) {
      for (const b of remaining) {
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (!best || d < best.d) best = { a, b, d }
      }
    }
    lines.push([best.a, best.b])
    inTree.push(best.b)
    remaining.splice(remaining.indexOf(best.b), 1)
  }
  return lines
}

// Middle of a group of points, for placing the constellation's name
export function centroid(points) {
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length
  return { x, y }
}

// ---------------------------------------------------------------------------
// Fallback layout, used until the ML supplies `position` for sessions.
// Across = when the session started. Up = its worst command severity (0-4),
// with sessions that have no rated commands on their own "Unrated" row at the bottom.

export const SEVERITY_ROWS = [null, 0, 1, 2, 3, 4] // bottom to top

function rowY(severity) {
  const index = SEVERITY_ROWS.indexOf(severity ?? null)
  const step = (HEIGHT - 2 * PADDING) / (SEVERITY_ROWS.length - 1)
  return HEIGHT - PADDING - Math.max(index, 0) * step
}

// Small stable offset from the session id, so sessions in the same row at
// nearly the same time don't sit exactly on top of each other.
function jitter(id) {
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 // -1 .. 1
}

export function timelineLayout(sessions) {
  const times = sessions.map((s) => Date.parse(s.started_at)).filter(Number.isFinite)
  const start = Math.min(...times)
  const end = Math.max(...times)
  const span = end - start
  const xOf = (t) => (span > 0 ? PADDING + ((t - start) / span) * (WIDTH - 2 * PADDING) : WIDTH / 2)
  const rowGap = (HEIGHT - 2 * PADDING) / (SEVERITY_ROWS.length - 1)

  const place = (s) => {
    const t = Date.parse(s.started_at)
    return {
      x: xOf(Number.isFinite(t) ? t : start),
      y: rowY(s.severity) + jitter(s.id) * rowGap * 0.3,
    }
  }

  const rows = SEVERITY_ROWS.map((sev) => ({
    y: rowY(sev),
    label: sev === null ? 'Unrated' : `Sev ${sev}`,
  }))

  // Time ticks along the bottom. Show the date once the range spans more than a day.
  const longRange = span > 36 * 3600 * 1000
  const fmt = (t) =>
    new Date(t).toLocaleString(undefined, longRange ? { month: 'short', day: 'numeric' } : { hour: '2-digit', minute: '2-digit' })
  const tickCount = span > 0 ? 5 : 1
  const ticks = times.length
    ? Array.from({ length: tickCount }, (_, i) => {
        const t = tickCount === 1 ? start : start + (span * i) / (tickCount - 1)
        return { x: xOf(t), label: fmt(t) }
      })
    : []

  return { place, rows, ticks }
}
