import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getClusters, getIocs, getSession } from '@/api'
import { catalogueId, formatDuration } from '@/lib/format'
import { highlightIocs } from '@/lib/highlight'
import Frame from '@/components/Frame'
import PageLoader from '@/components/PageLoader'

const SPEEDS = [1, 4, 16]

// The key makes React throw away the old replay and start fresh when the URL
// changes (e.g. clicking from one session to another), so all state resets.
export default function SessionDetail() {
  const { id } = useParams()
  return <Replay key={id} id={id} />
}

function Replay({ id }) {
  const [session, setSession] = useState(null)
  const [clusters, setClusters] = useState([])
  const [iocs, setIocs] = useState([])
  const [error, setError] = useState(null)

  // Playback state
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(4)
  const terminalRef = useRef(null)

  // Load the session, clusters and IOCs once
  useEffect(() => {
    Promise.all([getSession(id), getClusters(), getIocs()])
      .then(([s, c, i]) => {
        setSession(s)
        setClusters(c)
        setIocs(i)
      })
      .catch((err) => setError(err.message))
  }, [id])

  useEffect(() => {
    if (session?.status !== 'active') return
    const timer = setInterval(() => {
      getSession(id)
        .then((updatedSession) => {
          setSession(updatedSession)
          setError(null)
        })
        .catch((err) => setError(err.message))
    }, 5000)
    return () => clearInterval(timer)
  }, [id, session?.status])

  const events = session?.events ?? []
  const end = events.length ? events.at(-1).t + 1 : 0
  const finished = session !== null && (events.length === 0 || time >= end)

  // The playback clock: while playing, move time forward 10 times a second
  useEffect(() => {
    if (!playing || !session || events.length === 0 || finished) return
    const timer = setInterval(() => {
      setTime((t) => Math.min(t + 0.1 * speed, end))
    }, 100)
    return () => clearInterval(timer) // stop the old timer when anything changes
  }, [playing, speed, session, end, events.length, finished])

  // Keep the terminal scrolled to the newest line
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [time])

  if (!session && error) return <p className="text-destructive">Lost signal: {error}</p>
  if (!session) return <PageLoader />

  const cluster = clusters.find((c) => c.id === session.cluster_id)
  const sessionIocs = iocs.filter((i) => (i.session_ids ?? []).includes(session.id))
  const highlightValues = sessionIocs.map((i) => i.value).filter((v) => v !== session.src_ip)
  const visible = events.filter((e) => e.t <= time)

  function togglePlay() {
    if (finished) {
      setTime(0) // pressing play at the end restarts
      setPlaying(true)
    } else {
      setPlaying(!playing)
    }
  }

  return (
    <Frame
      title={session.src_ip}
      caption={`${catalogueId(session.id)} · ${session.protocol.toUpperCase()}`}
      leading={
        <Link to="/transmissions" className="text-sm text-muted-foreground hover:text-foreground">
          ← All transmissions
        </Link>
      }
    >
      {error && <p className="mb-4 text-sm text-destructive">Lost signal: {error}</p>}
      {/* Details */}
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <Meta label="SSH username" value={session.username ?? 'Unknown'} />
        <Meta label="Risk" value={session.session_flagged ? (session.session_priority === 'high' ? 'High priority' : 'Review') : 'Unflagged'} />
        <Meta label="Maximum severity" value={session.severity ?? 'Unknown'} />
        <Meta label="Origin" value={session.country ?? 'Unknown'} />
        <Meta
          label="Trapped"
          value={formatDuration(session.duration_s)}
          live={session.status === 'active'}
        />
        <Meta label="Constellation" value={cluster ? (cluster.name ?? cluster.label ?? cluster.id) : 'Uncharted'} serif />
        {session.status === 'active' && <span className="mb-1 text-sm text-live">● still connected</span>}
      </div>

      {session.session_flagged && <p className="mt-3 text-sm text-destructive [overflow-wrap:anywhere]">Flag reason: {session.session_flag_reason?.replaceAll('_', ' ') ?? 'Flagged for review'}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Terminal */}
        <div className="min-w-0 border border-border">
          <div
            ref={terminalRef}
            className="h-[420px] overflow-y-auto bg-[#0A0F1C] p-4 font-mono text-[13px] leading-relaxed [overflow-wrap:anywhere]"
          >
            {visible.map((e, i) => (
              <Line key={i} event={e} highlight={highlightValues} />
            ))}
            {events.length === 0 ? (
              <p className="text-muted-foreground">No activity recorded yet.</p>
            ) : (
              !finished && <span className="animate-pulse text-live">▌</span>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3">
            <button
              onClick={togglePlay}
              disabled={events.length === 0}
              className="w-16 text-left text-xs uppercase tracking-widest hover:text-live disabled:cursor-not-allowed disabled:text-muted-foreground"
            >
              {finished ? 'Replay' : playing ? 'Pause' : 'Play'}
            </button>
            <input
              type="range"
              min={0}
              max={end}
              step={0.1}
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
              disabled={events.length === 0}
              className="min-w-32 flex-1 accent-live"
              aria-label="Replay position"
            />
            <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
              {formatDuration(Math.floor(time))} / {formatDuration(Math.floor(end))}
            </span>
            <div className="flex gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`font-mono text-xs ${speed === s ? 'text-live' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <aside className="min-w-0 space-y-6">
          {cluster && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Constellation</div>
              <div className="mt-1 font-display text-2xl italic">{cluster.name ?? cluster.label ?? cluster.id}</div>
              <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{cluster.summary}</p>
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Indicators found · {sessionIocs.length}
            </div>
            <ul className="mt-2 space-y-2">
              {sessionIocs.map((i) => (
                <li key={i.id} className="border-l-2 border-live/60 pl-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{i.type}</div>
                  <div className="break-all font-mono text-xs">{i.value}</div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Frame>
  )
}

function Line({ event, highlight }) {
  if (event.type === 'login') {
    return <div className="mb-2 text-muted-foreground">── {event.text} ──</div>
  }
  if (event.type === 'input') {
    return (
      <div className="whitespace-pre-wrap">
        <span className="text-live">attacker $ </span>
        {highlightIocs(event.text, highlight)}
        {event.severity != null && <span className="ml-3 text-xs text-muted-foreground">[severity {event.severity} · confidence {event.confidence ?? 'unknown'}]</span>}
      </div>
    )
  }
  return (
    <div className="mb-2 whitespace-pre-wrap text-muted-foreground">
      {highlightIocs(event.text, highlight)}
    </div>
  )
}

function Meta({ label, value, live = false, serif = false }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`${serif ? 'font-display text-xl italic' : 'font-mono text-sm'} ${live ? 'text-live' : ''}`}>
        {value}
      </div>
    </div>
  )
}
