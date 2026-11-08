import sqlite3, threading
import os
from pathlib import Path
# This file opens the SQLite file, configures it and creates tables if they dont exist


#open / create database file 
DB_PATH = Path(os.environ.get("HONEYPOT_DB_PATH", str(Path(__file__).parent.parent / "data" / "honeypot.db")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
conn=sqlite3.connect(DB_PATH, check_same_thread=False)
# row=dict
conn.row_factory = sqlite3.Row
#Multi write 
conn.execute("PRAGMA journal_mode=WAL")
# One connection is shared by every request thread, so reads and writes both take this lock.
# Without it, parallel requests (the dashboard fires several at once) interleave on the
# connection and a query can come back empty -> IndexError -> 500.
# RLock so code already holding it (e.g. inside a write) can still call query().
tLock=threading.RLock()

def init_db():
    file_path = Path(__file__).parent / "schema.sql"

    with tLock:
        with open(file_path, "r", encoding="utf-8") as file:
            conn.executescript(file.read())

        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(events)")
        }

        if "username" not in columns:
            conn.execute("ALTER TABLE events ADD COLUMN username TEXT")

        if "password" not in columns:
            conn.execute("ALTER TABLE events ADD COLUMN password TEXT")

        migrations = {
            "events": {
                "severity": "INTEGER", "confidence": "REAL",
                "classification_error": "TEXT",
                "session_flagged": "INTEGER NOT NULL DEFAULT 0",
                "session_newly_flagged": "INTEGER NOT NULL DEFAULT 0",
                "session_priority": "TEXT", "session_flag_reason": "TEXT",
            },
            "sessions": {
                "username": "TEXT", "severity": "INTEGER",
                "session_flagged": "INTEGER NOT NULL DEFAULT 0",
                "session_priority": "TEXT", "session_flag_reason": "TEXT",
            },
        }
        for table, additions in migrations.items():
            existing = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
            for name, definition in additions.items():
                if name not in existing:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")
        conn.commit()
    
def query(sql, params=()):
    with tLock:
        curs=conn.execute(sql,params)
        return curs.fetchall()  