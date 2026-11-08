import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { getStats } from '@/api'
import { formatDuration } from '@/lib/format'

function Stat({ label, value, live = false }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm ${live ? 'text-live' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}

export default function TopBar({ navOpen, onToggleNav }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStats()
      .then((data) => setStats(data))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <header className="flex h-14 items-center gap-8 border-b border-border px-6">
      <button
        type="button"
        onClick={onToggleNav}
        aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={navOpen}
        className="-ml-2 -mr-4 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>
      <span className="font-display text-xl italic">Event Horizon</span>

      {error && <span className="text-sm text-destructive">Lost signal: {error}</span>}
      {!stats && !error && <span className="text-sm text-muted-foreground">Scanning the sky…</span>}

      {stats && (
        <div className="ml-auto flex gap-8">
          <Stat label="Active" value={stats.active_sessions} live />
          <Stat label="Sightings" value={stats.total_sessions} />
          <Stat label="Avg trapped" value={formatDuration(stats.avg_engaged_s)} />
          <Stat label="Constellations" value={stats.cluster_count} />
        </div>
      )}
    </header>
  )
}
