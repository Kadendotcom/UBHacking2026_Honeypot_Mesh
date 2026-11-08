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
