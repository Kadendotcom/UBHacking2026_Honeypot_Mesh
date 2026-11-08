import { NavLink } from 'react-router'

// Icons are drawn as SVG on the same 20×20 grid, filling the same space. Unicode
// glyphs (◉ ≋ ✶) came from different fallback fonts and rendered at different sizes.
const ICON_SIZE = 20

const icons = {
  // ◉ a ringed core
  horizon: (
    <>
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="4.5" fill="currentColor" />
    </>
  ),
  // ≋ three waves
  signals: (
    <path
      d="M2 5.5q2-2 4 0t4 0 4 0 4 0M2 10q2-2 4 0t4 0 4 0 4 0M2 14.5q2-2 4 0t4 0 4 0 4 0"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  ),
  // ✶ six-pointed star
  chart: <polygon points={starPoints(10, 10, 9, 3.6, 6)} fill="currentColor" />,
}

const links = [
  { to: '/', label: 'Horizon', icon: 'horizon', end: true },
  { to: '/transmissions', label: 'Signals', icon: 'signals' },
  { to: '/chart', label: 'Chart', icon: 'chart' },
]

export default function NavRail() {
  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-border pb-4 sm:w-20">
      {/* Mark: the black hole in miniature. Sits in a cell as tall as the top bar so the borders line up. */}
      <NavLink
        to="/"
        aria-label="GravityWell home"
        className="mb-4 flex h-14 w-full shrink-0 items-center justify-center border-b border-border"
      >
        <Mark />
      </NavLink>

      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            `relative flex w-full flex-col items-center gap-1 py-3 transition-colors ${
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-live" />
              )}
              <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="my-1">
                {icons[link.icon]}
              </svg>
              <span className="text-[10px] uppercase tracking-widest">{link.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function Mark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      {/* far half of the orbit, behind the hole */}
      <path d="M2 17 A15 5.5 0 0 1 32 17" stroke="var(--color-ink)" strokeOpacity="0.35" strokeWidth="0.9" transform="rotate(-18 17 17)" />
      <circle cx="17" cy="17" r="8.5" fill="none" stroke="var(--color-ink)" strokeOpacity="0.35" strokeWidth="0.8" />
      <circle cx="17" cy="17" r="6" fill="#05070D" stroke="var(--color-ink)" strokeWidth="1.1" />
      {/* near half of the orbit, in front of the hole */}
      <path d="M2 17 A15 5.5 0 0 0 32 17" stroke="var(--color-ink)" strokeOpacity="0.7" strokeWidth="0.9" transform="rotate(-18 17 17)" />
      <circle cx="30.2" cy="15.6" r="1.7" fill="var(--color-live)" />
    </svg>
  )
}

// Points of a star polygon, alternating between the outer and inner radius
function starPoints(cx, cy, outer, inner, spikes) {
  const pts = []
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / spikes) * i - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}
