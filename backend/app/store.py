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
            """INSERT INTO events (session_id, ts, type, command, response) VALUES (?, ?, ?, ?, ?)""",
            (ev.session_id, ts, ev.type, ev.command, ev.response),)
        db.conn.execute("""UPDATE sessions SET last_seen_at = ?, event_count = event_count + 1  WHERE id = ?""",(ts, ev.session_id),)
        if ev.type == "logout": db.conn.execute( "UPDATE sessions SET status = 'closed', ended_at = ? WHERE id = ?", (ts, ev.session_id),)
        db.conn.commit()
def list_sessions():
    db.query("SELECT * FROM sessions ORDER BY started_at DESC")
    return db.query("SELECT * FROM sessions ORDER BY started_at DESC")

def list_session_events(session_id: str):
    return db.query(
        """
        SELECT id, session_id, ts, type, command, response
        FROM events
        WHERE session_id = ?
        ORDER BY id ASC
        """,
        (session_id,),
    )

