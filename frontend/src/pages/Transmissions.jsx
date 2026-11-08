import { useState } from 'react'
import { useNavigate } from 'react-router'
import { getClusters, getSessions } from '@/api'
import { catalogueId, formatDuration, timeAgo } from '@/lib/format'
import usePolling from '@/lib/usePolling'
import Frame from '@/components/Frame'
import PageLoader from '@/components/PageLoader'

export default function Transmissions() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const { data, error } = usePolling(async () => {
    const [sessions, clusters] = await Promise.all([getSessions(), getClusters()])
    return { sessions, clusters }
  })

  if (!data && error) return <p className="text-destructive">Lost signal: {error}</p>
  if (!data) return <PageLoader />

  const { sessions, clusters } = data
  const clusterName = (id) => {
    const c = clusters.find((c) => c.id === id)
    return c ? (c.name ?? c.label ?? c.id) : undefined
  }

  const shown = sessions
    .filter((s) => filter === 'all' || s.status === 'active')
    .filter((s) => s.src_ip.includes(search.trim()))

  return (
    <Frame title="Transmissions" fill>
      <div className="flex min-h-0 flex-1 flex-col">
        {error && <p className="mb-4 shrink-0 text-sm text-destructive">Lost signal: {error}</p>}
        <div className="flex shrink-0 items-center gap-4">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            All · {sessions.length}
          </FilterButton>
          <FilterButton active={filter === 'live'} onClick={() => setFilter('live')}>
            Live · {sessions.filter((s) => s.status === 'active').length}
          </FilterButton>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IP…"
            className="ml-auto w-56 border border-border bg-transparent px-3 py-1.5 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="py-2 font-normal">Catalogue</th>
                <th className="py-2 font-normal">Origin</th>
                <th className="py-2 font-normal">Via</th>
                <th className="py-2 font-normal">Constellation</th>
                <th className="py-2 font-normal">Trapped</th>
                <th className="py-2 font-normal">Sighted</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/transmissions/${s.id}`)}
                  className="cursor-pointer border-b border-border/50 transition-colors hover:bg-card"
                >
                  <td className="py-3 font-mono">
                    {s.status === 'active' && <span className="mr-2 text-live">●</span>}
                    {catalogueId(s.id)}
                  </td>
                  <td className="py-3 font-mono">
                    {s.src_ip} <span className="text-muted-foreground">{s.country ?? 'Unknown'}</span>
                  </td>
                  <td className="py-3 font-mono uppercase text-muted-foreground">{s.protocol}</td>
                  <td className="py-3 font-display text-base italic">
                    {clusterName(s.cluster_id) ?? <span className="text-muted-foreground">Uncharted</span>}
                  </td>
                  <td className={`py-3 font-mono ${s.status === 'active' ? 'text-live' : ''}`}>
                    {formatDuration(s.duration_s)}
                  </td>
                  <td className="py-3 text-muted-foreground">{timeAgo(s.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {shown.length === 0 && (
            <p className="mt-8 text-center text-muted-foreground">No signals match. The sky is quiet.</p>
          )}
        </div>
      </div>
    </Frame>
  )
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 pb-1 text-xs uppercase tracking-widest transition-colors ${
        active ? 'border-live text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
