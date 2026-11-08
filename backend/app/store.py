from . import db
from .models import EventIn
from datetime import datetime, timezone

def now():
    # using milliseconds instead of seconds for better timestamp updates
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

def insert_event(ev:EventIn):
    ts=ev.ts or now()
    with db.tLock:
        db.conn.execute(
        """INSERT INTO sessions (id,src_ip, protocol, node_id, started_at, last_seen_at, status) VALUES (?,?,?,?,?,?,'active') ON CONFLICT(id) DO NOTHING""", (ev.session_id, ev.src_ip, ev.protocol, ev.node_id, ts,ts ), ) 
        db.conn.execute(
            """
            INSERT INTO events (
                session_id, ts, type, username, password, command, response,
                severity, confidence, classification_error, session_flagged,
                session_newly_flagged, session_priority, session_flag_reason
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ev.session_id,
                ts,
                ev.type,
                ev.username,
                ev.password,
                ev.command,
                ev.response,
                ev.severity, ev.confidence, ev.classification_error,
                ev.session_flagged, ev.session_newly_flagged,
                ev.session_priority, ev.session_flag_reason,
            ),
        )
        db.conn.execute("""UPDATE sessions SET last_seen_at = ?, event_count = event_count + 1  WHERE id = ?""",(ts, ev.session_id),)
        db.conn.execute("""
            UPDATE sessions SET
                username = COALESCE(?, username),
                severity = CASE WHEN severity IS NULL OR ? > severity THEN ? ELSE severity END,
                session_flagged = MAX(session_flagged, ?),
                session_priority = CASE
                    WHEN session_priority = 'high' THEN 'high'
                    WHEN ? IS NOT NULL THEN ? ELSE session_priority END,
                session_flag_reason = CASE
                    WHEN session_priority = 'high' THEN session_flag_reason
                    ELSE COALESCE(?, session_flag_reason) END
            WHERE id = ?
        """, (ev.username, ev.severity, ev.severity,
              ev.session_flagged or ev.session_priority is not None,
              ev.session_priority, ev.session_priority, ev.session_flag_reason,
              ev.session_id))
        if ev.type == "logout": db.conn.execute( "UPDATE sessions SET status = 'closed', ended_at = ? WHERE id = ?", (ts, ev.session_id),)
        db.conn.commit()
def list_session_events(session_id: str):
    return db.query(
        """
        SELECT id, session_id, ts, type,
               username, password, command, response, severity, confidence,
               classification_error, session_flagged, session_newly_flagged,
               session_priority, session_flag_reason
        FROM events
        WHERE session_id = ?
        ORDER BY id ASC
        """,
        (session_id,),
    )
def list_events(after_id: int = 0, limit: int = 100):
    return db.query(
        """
        SELECT
            e.id, e.session_id, e.ts, e.type,
            e.command, e.response, e.username, e.severity, e.confidence,
            e.classification_error, e.session_flagged, e.session_newly_flagged,
            e.session_priority, e.session_flag_reason,
            s.src_ip, s.node_id, s.protocol
        FROM events AS e
        JOIN sessions AS s ON s.id = e.session_id
        WHERE e.id > ?
        ORDER BY e.id ASC
        LIMIT ?
        """,
        (after_id, limit),
    )
# Average seconds a plain (non-LLM) honeypot holds an attacker.
# Placeholder for the dashboard's comparison tile -- replace with a real number.
BASELINE_AVG_S = 14

# One honeypot for now. Must match the node_id base_server.py reports.
NODES = [
    {"id": "n1", "name": "Kepler", "persona": "Ubuntu 22.04 LTS"},
]

# Shared SELECT so the list and detail views can never drift apart.
# julianday() parses our ISO timestamps and returns days, so *86400 gives
# seconds. COALESCE(ended_at, last_seen_at) handles sessions still running.
SESSION_SELECT = """
    SELECT id, src_ip, country, protocol, node_id,
           started_at, ended_at, status, event_count, cluster_id,
           username, severity, session_flagged, session_priority, session_flag_reason,
           CAST((julianday(COALESCE(ended_at, last_seen_at))
                 - julianday(started_at)) * 86400 AS INTEGER) AS duration_s
    FROM sessions
"""


def _scalar(sql, params=()):
    """Run a query that returns one row with one column, and return that value."""
    return db.query(sql, params)[0][0]


def _ioc_ids_by_session():
    """{session_id: ["i3", "i7"]} -- the frontend wants ids, not values."""
    out = {}
    for row in db.query("SELECT session_id, id FROM iocs ORDER BY id"):
        out.setdefault(row["session_id"], []).append(f"i{row['id']}")
    return out


def _seconds_since(start, ts):
    """Seconds between two ISO-8601 strings. 0.0 if either is unparseable."""
    try:
        a = datetime.fromisoformat(start.replace("Z", "+00:00"))
        b = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return round((b - a).total_seconds(), 1)
    except (AttributeError, ValueError):
        return 0.0


def list_sessions():
    """Session list for the dashboard, newest first. No events."""
    ioc_map = _ioc_ids_by_session()
    return [
        {
            **dict(row),
            "position": None,          # Person 3 (ML) supplies this
            "ioc_ids": ioc_map.get(row["id"], []),
        }
        for row in db.query(SESSION_SELECT + " ORDER BY started_at DESC")
    ]


def get_session(session_id: str):
    """One session with its events nested, for the replay view.

    Each stored command row becomes TWO events -- the attacker's input and the
    honeypot's output -- because that is how the frontend renders a terminal.
    `t` is seconds since the session started.
    """
    rows = db.query(SESSION_SELECT + " WHERE id = ?", (session_id,))
    if not rows:
        return None

    session = dict(rows[0])
    session["position"] = None
    session["ioc_ids"] = _ioc_ids_by_session().get(session_id, [])

    started_at = session["started_at"]
    events = []

    for e in list_session_events(session_id):
        t = _seconds_since(started_at, e["ts"])

        if e["type"] == "login":
            events.append({
                "t": t,
                "type": "login",
                "text": f"login {e['username']} / {e['password']}  accepted",
            })
        elif e["type"] == "logout":
            events.append({"t": t, "type": "output", "text": "logout"})
        else:
            if e["command"]:
                events.append({"t": t, "type": "input", "text": e["command"],
                               **{key: e[key] for key in (
                                   "severity", "confidence", "classification_error",
                                   "session_flagged", "session_priority", "session_flag_reason")}})
            if e["response"]:
                events.append({"t": t, "type": "output", "text": e["response"]})

    session["events"] = events
    return session


def list_clusters():
    """Clusters with their session counts. Empty until the ML writes some.

    LEFT JOIN so a cluster with zero sessions still appears; a plain JOIN
    would silently hide it.
    """
    rows = db.query(
        """
        SELECT c.id, c.name, c.label, c.summary, c.first_seen, c.last_seen,
               COUNT(s.id) AS session_count
        FROM clusters AS c
        LEFT JOIN sessions AS s ON s.cluster_id = c.id
        GROUP BY c.id
        ORDER BY session_count DESC
        """
    )
    # mitre and ioc_ids aren't stored yet -- return the keys so the frontend
    # can render without null checks.
    return [{**dict(r), "mitre": [], "ioc_ids": []} for r in rows]


def list_iocs():
    """Unique indicators, grouped across sessions.

    The table stores one row per (session, indicator); the frontend wants one
    row per indicator with the list of sessions it appeared in.
    """
    rows = db.query(
        """
        SELECT MIN(id)         AS id,
               type,
               value,
               MIN(first_seen) AS first_seen,
               MAX(first_seen) AS last_seen,
               GROUP_CONCAT(session_id) AS session_ids
        FROM iocs
        GROUP BY type, value
        ORDER BY MIN(id) DESC
        """
    )
    return [
        {
            "id": f"i{r['id']}",
            "type": r["type"],
            "value": r["value"],
            "first_seen": r["first_seen"],
            "last_seen": r["last_seen"],
            "session_ids": (r["session_ids"] or "").split(","),
            "cluster_ids": [],      # needs the ML
            "confidence": None,     # not computed yet
        }
        for r in rows
    ]


def get_stats():
    """Headline numbers for the dashboard tiles."""
    total_sessions = _scalar("SELECT COUNT(*) FROM sessions")

    total_engaged_s = int(_scalar(
        """
        SELECT COALESCE(SUM((julianday(COALESCE(ended_at, last_seen_at))
                             - julianday(started_at)) * 86400), 0)
        FROM sessions
        """
    ))

    return {
        "active_sessions": _scalar(
            "SELECT COUNT(*) FROM sessions WHERE status = 'active'"
        ),
        "total_sessions": total_sessions,
        "flagged_sessions": _scalar("SELECT COUNT(*) FROM sessions WHERE session_flagged = 1"),
        "high_priority_sessions": _scalar("SELECT COUNT(*) FROM sessions WHERE session_priority = 'high'"),
        "total_engaged_s": total_engaged_s,
        "avg_engaged_s": round(total_engaged_s / total_sessions) if total_sessions else 0,
        "baseline_avg_s": BASELINE_AVG_S,
        "cluster_count": _scalar("SELECT COUNT(*) FROM clusters"),
        "ioc_count": _scalar("SELECT COUNT(DISTINCT type || value) FROM iocs"),
        "nodes": NODES,
    }

