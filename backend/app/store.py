from . import db
from .models import EventIn
from datetime import datetime, timezone

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def insert_event(ev:EventIn):
    ts=ev.ts or now()
    with db.tLock:
        db.conn.execute(
        """INSERT INTO sessions (id,src_ip, protocol, node_id, started_at, last_seen_at, status) VALUES (?,?,?,?,?,?,'active') ON CONFLICT(id) DO NOTHING""", (ev.session_id, ev.src_ip, ev.protocol, ev.node_id, ts,ts ), ) 
        db.conn.execute(
            """
            INSERT INTO events (
                session_id, ts, type, username, password, command, response
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ev.session_id,
                ts,
                ev.type,
                ev.username,
                ev.password,
                ev.command,
                ev.response,
            ),
        )
        db.conn.execute("""UPDATE sessions SET last_seen_at = ?, event_count = event_count + 1  WHERE id = ?""",(ts, ev.session_id),)
        if ev.type == "logout": db.conn.execute( "UPDATE sessions SET status = 'closed', ended_at = ? WHERE id = ?", (ts, ev.session_id),)
        db.conn.commit()
def list_session_events(session_id: str):
    return db.query(
        """
        SELECT id, session_id, ts, type,
               username, password, command, response
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
            e.command, e.response,
            s.src_ip, s.node_id, s.protocol
        FROM events AS e
        JOIN sessions AS s ON s.id = e.session_id
        WHERE e.id > ?
        ORDER BY e.id ASC
        LIMIT ?
        """,
        (after_id, limit),
    )
def list_sessions():
    return db.query("SELECT * FROM sessions ORDER BY started_at DESC")

