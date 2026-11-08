import sqlite3, threading
from pathlib import Path
# This file opens the SQLite file, configures it and creates tables if they dont exist


#open / create database file 
DB_PATH=Path(__file__).parent.parent/"data"/"honeypot.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
conn=sqlite3.connect(DB_PATH, check_same_thread=False)
# row=dict
conn.row_factory = sqlite3.Row
#Multi write 
conn.execute("PRAGMA journal_mode=WAL")
#Thread lock stops 2 writes from happening at the same time
tLock=threading.Lock()

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

        conn.commit()
    
def query(sql, params=()):
    curs=conn.execute(sql,params)
    return curs.fetchall()
