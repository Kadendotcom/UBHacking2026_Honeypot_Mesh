import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

// Drawing area and the black hole's size
const W = 640
const H = 300
const CX = W / 2
const CY = H / 2
const HOLE_R = 44
const TILT = 0.32 // how flat the orbits look (1 = circle, 0 = a line)
const ORBIT_RADII = [90, 160, 230, 280]

// Longer trapped → orbit closer to the hole ("pulled in").
function orbitRadius(durationSeconds) {
  const pull = Math.min(durationSeconds / 420, 1) // 0 = just arrived, 1 = 7+ minutes
  return 280 - pull * 190
}

// Kepler's third law: closer orbits move faster.
function orbitSpeed(radius) {
  return 900 / Math.pow(radius, 1.5) // radians per second
}

// The animation clock: seconds since the component appeared.
// Re-renders this component ~60 times a second while running.
function useClock(running) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!running) return
    let frame
    const start = performance.now()
    const tick = (now) => {
      setSeconds((now - start) / 1000)
      frame = requestAnimationFrame(tick) // ask the browser to call us again next frame
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running])

  return seconds
}

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function BlackHole({ sessions }) {
  const t = useClock(!prefersReducedMotion)
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(null)

  // Work out where every attacker is right now
  const bodies = sessions.slice(0, 60).map((s, i) => {
    const r = orbitRadius(s.duration_s)
    const angle = i * 2.39996 + t * orbitSpeed(r) // 2.39996 = golden angle, spreads them out
    return {
      session: s,
      x: CX + r * Math.cos(angle),
      y: CY + r * TILT * Math.sin(angle),
      behind: Math.sin(angle) < 0, // top half of the orbit is the far side
      active: s.status === 'active',
    }
  })

  const hoveredBody = bodies.find((b) => b.session.id === hovered?.id)
  const behind = bodies.filter((b) => b.behind)
  const inFront = bodies.filter((b) => !b.behind)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Attackers orbiting the honeypot">
        <defs>
          {/* Diagonal lines, like the shading on an old engraving */}
          <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="#EDE4D0" strokeWidth="0.8" strokeOpacity="0.5" />
          </pattern>
        </defs>

        {/* Orbit guides: thin solid lines */}
        {ORBIT_RADII.map((r) => (
          <ellipse key={r} cx={CX} cy={CY} rx={r} ry={r * TILT} fill="none" stroke="#EDE4D0" strokeOpacity={0.12} />
        ))}

        {/* 1. Attackers on the far side, dimmer */}
        {behind.map((b) => (
          <Body key={b.session.id} body={b} dim onHover={setHovered} onClick={() => navigate(`/transmissions/${b.session.id}`)} />
        ))}

        {/* 2. The horizon, engraved */}
        <Engraving />

        {/* Near-side orbit guides pass in front of the horizon. */}
        {ORBIT_RADII.map((r) => (
          <path
            key={`front-${r}`}
            d={`M ${CX - r} ${CY} A ${r} ${r * TILT} 0 0 0 ${CX + r} ${CY}`}
            fill="none"
            stroke="#EDE4D0"
            strokeOpacity={0.12}
          />
        ))}

        {/* 3. Attackers on the near side */}
        {inFront.map((b) => (
          <Body key={b.session.id} body={b} onHover={setHovered} onClick={() => navigate(`/transmissions/${b.session.id}`)} />
        ))}
      </svg>

      {hoveredBody && (
        <div
          className="pointer-events-none absolute border border-border bg-card px-3 py-2 font-mono text-xs"
          style={{ left: `${(hoveredBody.x / W) * 100}%`, top: `${(hoveredBody.y / H) * 100}%`, transform: 'translate(14px, 14px)' }}
        >
          <div>{hovered.src_ip}</div>
          <div className="text-muted-foreground">
            {hovered.status === 'active' ? 'still falling in' : 'escaped'} · {hovered.country ?? 'Unknown'}
          </div>
        </div>
      )}
    </div>
  )
}

// The black hole drawn like a star-atlas engraving: line art, hatching, a tick scale
function Engraving() {
  const ink = '#EDE4D0'
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5) // every 5 degrees

  return (
    <g>
      {/* Tick ring, like the scale on an astrolabe */}
      {ticks.map((deg) => {
        const a = (deg * Math.PI) / 180
        const long = deg % 30 === 0
        const r1 = HOLE_R + 22
        const r2 = r1 + (long ? 8 : 4)
        return (
          <line
            key={deg}
            x1={CX + r1 * Math.cos(a)} y1={CY + r1 * Math.sin(a)}
            x2={CX + r2 * Math.cos(a)} y2={CY + r2 * Math.sin(a)}
            stroke={ink} strokeOpacity={long ? 0.7 : 0.35} strokeWidth={0.8}
          />
        )
      })}

      {/* Concentric rings */}
      <circle cx={CX} cy={CY} r={HOLE_R + 16} fill="none" stroke={ink} strokeOpacity={0.3} strokeWidth={0.8} />
      <circle cx={CX} cy={CY} r={HOLE_R + 9} fill="url(#hatch)" stroke={ink} strokeOpacity={0.6} strokeWidth={0.8} />

      {/* The horizon itself: solid dark, crisp edge */}
      <circle cx={CX} cy={CY} r={HOLE_R} fill="#05070D" stroke={ink} strokeWidth={1.4} />

      {/* Crosshair marks at the four compass points */}
      {[0, 90, 180, 270].map((deg) => {
        const a = (deg * Math.PI) / 180
        return (
          <line
            key={deg}
            x1={CX + (HOLE_R + 34) * Math.cos(a)} y1={CY + (HOLE_R + 34) * Math.sin(a)}
            x2={CX + (HOLE_R + 52) * Math.cos(a)} y2={CY + (HOLE_R + 52) * Math.sin(a)}
            stroke={ink} strokeOpacity={0.6} strokeWidth={0.8}
          />
        )
      })}

      {/* Leader line and label */}
      <polyline
        points={`${CX + 58},${CY - 58} ${CX + 92},${CY - 92} ${CX + 290},${CY - 92}`}
        fill="none" stroke={ink} strokeOpacity={0.5} strokeWidth={0.8}
      />
      <text x={CX + 96} y={CY - 98} className="fill-foreground font-mono text-[9px] uppercase tracking-[0.2em]">
        EH-0 · The Horizon
      </text>
    </g>
  )
}

function Body({ body, dim = false, onHover, onClick }) {
  const color = body.active ? 'var(--color-live)' : 'var(--foreground)'
  return (
    <g
      className="cursor-pointer"
      opacity={dim ? 0.45 : 1}
      onMouseEnter={() => onHover(body.session)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      <circle cx={body.x} cy={body.y} r={12} fill="transparent" />
      {body.active && <circle cx={body.x} cy={body.y} r={8} fill="none" stroke={color} strokeOpacity={0.5} />}
      <circle cx={body.x} cy={body.y} r={body.active ? 4 : 2.5} fill={color} />
    </g>
  )
}
