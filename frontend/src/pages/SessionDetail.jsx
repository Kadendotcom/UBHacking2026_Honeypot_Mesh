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

  const end = session ? session.events.at(-1).t + 1 : 0
  const finished = session !== null && time >= end

  // The playback clock: while playing, move time forward 10 times a second
  useEffect(() => {
    if (!playing || !session || finished) return
    const timer = setInterval(() => {
      setTime((t) => Math.min(t + 0.1 * speed, end))
    }, 100)
    return () => clearInterval(timer) // stop the old timer when anything changes
  }, [playing, speed, session, end, finished])

  // Keep the terminal scrolled to the newest line
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [time])

  if (error) return <p className="text-destructive">Lost signal: {error}</p>
  if (!session) return <PageLoader />

  const cluster = clusters.find((c) => c.id === session.cluster_id)
  const sessionIocs = iocs.filter((i) => session.ioc_ids.includes(i.id))
  const highlightValues = sessionIocs.map((i) => i.value).filter((v) => v !== session.src_ip)
  const visible = session.events.filter((e) => e.t <= time)

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
      {/* Details */}
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <Meta label="Origin" value={session.country} />
        <Meta
          label="Trapped"
          value={formatDuration(session.duration_s)}
          live={session.status === 'active'}
        />
        <Meta label="Constellation" value={cluster?.name ?? 'Uncharted'} serif />
        {session.status === 'active' && <span className="mb-1 text-sm text-live">● still connected</span>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Terminal */}
        <div className="border border-border">
          <div
            ref={terminalRef}
            className="h-[420px] overflow-y-auto bg-[#0A0F1C] p-4 font-mono text-[13px] leading-relaxed"
          >
            {visible.map((e, i) => (
              <Line key={i} event={e} highlight={highlightValues} />
            ))}
            {!finished && <span className="animate-pulse text-live">▌</span>}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 border-t border-border px-4 py-3">
            <button onClick={togglePlay} className="w-16 text-left text-xs uppercase tracking-widest hover:text-live">
              {finished ? 'Replay' : playing ? 'Pause' : 'Play'}
            </button>
            <input
              type="range"
              min={0}
              max={end}
              step={0.1}
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
              className="flex-1 accent-live"
              aria-label="Replay position"
            />
            <span className="w-32 whitespace-nowrap text-right font-mono text-xs text-muted-foreground">
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
        <aside className="space-y-6">
          {cluster && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Constellation</div>
              <div className="mt-1 font-display text-2xl italic">{cluster.name}</div>
              <p className="mt-1 text-sm text-muted-foreground">{cluster.summary}</p>
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
