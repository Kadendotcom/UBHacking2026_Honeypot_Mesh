import { getStats } from '@/api'
import { formatDuration } from '@/lib/format'
import usePolling from '@/lib/usePolling'

function Stat({ label, value, live = false }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm ${live ? 'text-live' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}

export default function TopBar() {
  const { data: stats, error } = usePolling(getStats)

  return (
    <header className="flex h-14 items-center gap-8 border-b border-border px-6">
      <span className="font-display text-xl italic">Gravity Well</span>

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
