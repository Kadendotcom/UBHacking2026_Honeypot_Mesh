import { getStats } from '@/api'
import { formatDuration } from '@/lib/format'
import usePolling from '@/lib/usePolling'

function Stat({ label, value, live = false, className = '' }) {
  return (
    <div className={`flex flex-col whitespace-nowrap ${className}`}>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm ${live ? 'text-live' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}

export default function TopBar() {
  const { data: stats, error } = usePolling(getStats)

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 overflow-hidden border-b border-border px-4 sm:gap-8 sm:px-6">
      <span className="shrink-0 whitespace-nowrap font-display text-xl italic">GravityWell</span>

      {error && <span className="truncate text-sm text-destructive">Lost signal: {error}</span>}
      {!stats && !error && <span className="truncate text-sm text-muted-foreground">Scanning the sky…</span>}

      {stats && (
        <div className="ml-auto flex gap-5 sm:gap-8">
          <Stat label="Active" value={stats.active_sessions} live />
          <Stat label="Sightings" value={stats.total_sessions} className="max-sm:hidden" />
          <Stat label="Avg trapped" value={formatDuration(stats.avg_engaged_s)} className="max-md:hidden" />
          <Stat label="Constellations" value={stats.cluster_count} className="max-lg:hidden" />
        </div>
      )}
    </header>
  )
}
