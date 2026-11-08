// One star on the chart. Shape = attack category, size = time trapped.

export const CATEGORIES = {
  recon: 'Reconnaissance',
  botnet: 'Botnet',
  miner: 'Cryptominer',
  credential_theft: 'Credential theft',
  web_exploit: 'Web exploit',
  unknown: 'Unknown',
}

export default function StarSymbol({ category, x, y, r, active = false, faint = false }) {
  const color = active ? 'var(--color-live)' : 'var(--foreground)'
  const props = { fill: color, opacity: faint ? 0.35 : 1 }

  let shape
  switch (category) {
    case 'recon': // open circle
      shape = <circle cx={x} cy={y} r={r} fill="var(--background)" stroke={color} strokeWidth={1.5} opacity={props.opacity} />
      break
    case 'botnet': // six-pointed star
      shape = <polygon points={starPoints(x, y, r * 1.4, r * 0.6, 6)} {...props} />
      break
    case 'miner': // diamond
      shape = <polygon points={`${x},${y - r * 1.3} ${x + r},${y} ${x},${y + r * 1.3} ${x - r},${y}`} {...props} />
      break
    case 'credential_theft': // triangle
      shape = <polygon points={`${x},${y - r * 1.3} ${x + r * 1.15},${y + r * 0.8} ${x - r * 1.15},${y + r * 0.8}`} {...props} />
      break
    case 'web_exploit': // square
      shape = <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} {...props} />
      break
    default: // unknown: small dot
      shape = <circle cx={x} cy={y} r={Math.min(r, 3)} {...props} />
  }

  return (
    <g>
      {active && <circle cx={x} cy={y} r={r * 2.4} fill="none" stroke={color} className="star-pulse" />}
      {shape}
    </g>
  )
}

// Points of a star polygon: alternate between outer and inner radius around a circle
function starPoints(cx, cy, outer, inner, spikes) {
  const pts = []
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = (Math.PI / spikes) * i - Math.PI / 2
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`)
  }
  return pts.join(' ')
}
