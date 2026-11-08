# UB Hacking 2026 — Honeypot Mesh

A mesh of LLM-driven SSH honeypots. They impersonate a real Linux server,
record every command an attacker types, cluster the sessions into attacker
archetypes, and show it all on a live dashboard.

**Nothing an attacker types is ever executed.** The honeypot only returns text.

## Layout

| Path | What | Owner |
|---|---|---|
| `base_server.py` | Paramiko SSH honeypot — the fake shell | Person 1 |
| `backend/` | Collector API — FastAPI + SQLite, IOC extraction *(in progress)* | Person 2 |
| `ml/` | Session clustering *(not started)* | Person 3 |
| `frontend/` | Vite + React + Tailwind + shadcn dashboard | Person 4 |
| `gen-keys.sh` | Generates the SSH host keys the honeypot needs | — |
| `frontend/API_CONTRACT.md` | The JSON shape every endpoint returns | — |

---

## Requirements

> Incomplete — components are still landing. Add to this as you pull in a
> dependency, so nobody has to guess why a fresh clone won't run.

### System tools

| Tool | Version | Install (Fedora) | Needed for |
|---|---|---|---|
| Python | 3.11+ (3.14 verified) | `sudo dnf install python3` | honeypot, backend, ML |
| Node.js | 20+ (repo has 22 LTS) | `sudo dnf install nodejs` | frontend |
| git | any | `sudo dnf install git` | everything |
| OpenSSH client | any | `sudo dnf install openssh-clients` | `ssh-keygen` for `gen-keys.sh`, and connecting to the honeypot to test it |

### Python packages

| Component | Packages |
|---|---|
| Honeypot (`base_server.py`) | `paramiko` |
| Backend (`backend/`) | `fastapi`, `uvicorn[standard]`, `pydantic`, `httpx`, `python-dotenv` — plus `pytest` for dev |
| ML (`ml/`) | `torch` (PyTorch), `numpy`, `pandas` — session clustering runs fine on CPU |
| Fine-tuning (Colab, not local) | `unsloth`, `transformers`, `peft`, `trl`, `datasets` |

SQLite needs no install; it's in the Python standard library.

Each component gets its own venv and its own `requirements.txt`, so one
person's dependency bump doesn't break everyone else.

### Node packages

All declared in `frontend/package.json` — React, Vite, Tailwind, shadcn/ui,
React Router. `npm install` is the only command you need.

### LLM

**Model:** [Qwen/Qwen2.5-Coder-0.5B](https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B)
— 0.49B params, Apache-2.0, 32k context. Small enough to run on CPU at the
demo, which means no API key, no network dependency and no spending cap to
worry about.

**Fine-tuning:** LoRA via [Unsloth](https://unsloth.ai/docs/get-started/fine-tuning-llms-guide/lora-hyperparameters-guide),
on terminal-transcript data so the model emits only shell output.

**Where fine-tuning runs:** Google Colab free tier (T4), not this laptop — see
[Known gaps](#known-gaps). A 0.5B LoRA fits a T4 comfortably.

**Inference at demo time:** export the merged model to GGUF and serve it with
Ollama or `llama.cpp` on CPU. A 0.5B model is fast enough for interactive use
without a GPU.

Two things to be aware of:

- `Qwen2.5-Coder-0.5B` is a **base** model. Its own model card says *"we do not
  recommend using base language models for conversations"* — it will not follow
  a system prompt reliably. That's fine as a fine-tuning starting point, but if
  the fine-tune isn't ready in time, **the fallback is
  `Qwen2.5-Coder-0.5B-Instruct`**, which does follow prompts out of the box.
  Decide the fallback before the hackathon, not during it.
- At 0.5B, expect to do real prompt and output cleanup. Keep the honeypot's
  local command handler (`ls`, `cd`, `cat`, `pwd`) for anything that must be
  consistent, and only send unusual commands to the model.

If a hosted API gets added later as a fallback, its key goes in `.env` and
never in the repo.

---

## First-time setup

```bash
git clone https://github.com/Kadendotcom/UBHacking2026_Honeypot_Mesh.git
cd UBHacking2026_Honeypot_Mesh
```

### 1. Generate SSH keys (required — not in the repo)

```bash
chmod +x gen-keys.sh
./gen-keys.sh
```

`keys/` is gitignored, so **every clone must do this**. Without it
`base_server.py` fails on startup with a missing-file error.

### 2. Honeypot (Python)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install paramiko
```

### 3. Backend (Python, separate venv)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set COLLECTOR_TOKEN
cd ..
```

Generate a token:

```bash
python -c "import secrets; print(secrets.token_urlsafe(24))"
```

### 4. Frontend (Node 20+)

```bash
sudo dnf install nodejs      # Fedora: gives Node 22 LTS + npm
cd frontend
npm install
cd ..
```

---

## After every `git pull`

```bash
git pull

ls keys/ || ./gen-keys.sh                        # keys are never committed

source .venv/bin/activate && pip install paramiko
cd backend && source .venv/bin/activate && pip install -r requirements.txt && cd ..
cd frontend && npm install && cd ..              # if package.json changed
```

If a teammate added a dependency and you skipped this, you'll get an import
error that looks like a code bug. Check here first.

---

## Running the stack

Three terminals:

```bash
# 1. Honeypot — listens on 127.0.0.1:2222 (this machine only).
#    To let other devices connect, see "Letting someone else connect" below.
source .venv/bin/activate
python base_server.py

# 2. Collector API — http://127.0.0.1:8000/docs
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 3. Dashboard — http://localhost:5173
cd frontend && npm run dev
```

Connect to the honeypot:

```bash
ssh root@127.0.0.1 -p 2222        # any username, any password
```

---

## Letting someone else connect (the demo)

By default the honeypot binds `127.0.0.1`, so **only the machine running it can
connect**. That's deliberate: it's the only safe default on a network you don't own.

for multi machine put machines on a priv netwrok

A phone hotspot is **your own network**. Nothing is on it but the devices you
invited, so there's no policy to breach and no isolation to fight.

### Setup

1. Turn on your phone's hotspot with a strong password. A travel router
   (GL.iNet or similar) is more reliable — phones sometimes drop the hotspot
   when the screen locks. Bring a charger either way.
2. Join it with the demo laptop **and** the judge's laptop.
3. Start the honeypot exposed:

   ```bash
   HONEYPOT_HOST=0.0.0.0 MAX_SESSIONS=5 python base_server.py
   ```

4. Read the connect command out of the startup banner:

   ```
   Honeypot listening on 0.0.0.0:2222 (max 5 concurrent sessions)
     EXPOSED on every network interface. Connect with:
       ssh root@172.20.10.2 -p 2222
     Any password is accepted.
     Confirm the address above belongs to your own hotspot, NOT campus or venue Wi-Fi.
   ```

   **Check that address.** A hotspot gives you something like `172.20.10.x`
   (iPhone) or `192.168.x.x`. If you see `10.84.x.x` you are still on UB
   wireless — reconnect before continuing.

5. Put that exact command on a card or slide for the judge. Any password works.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `HONEYPOT_HOST` | `127.0.0.1` | `0.0.0.0` exposes it to the network |
| `HONEYPOT_PORT` | `2222` | Keep it above 1024 so it needn't run as root |
| `MAX_SESSIONS` | `5` | Connections past this are refused, not queued |

The collector API, the dashboard and the ML service all stay on `127.0.0.1`.
**Only the honeypot port is ever reachable from the network.**

### Test before judging

- A teammate's laptop joins the hotspot and SSHes in successfully
- Their session appears on the dashboard
- `http://<your-ip>:8000` and `:5173` are **not** reachable from their laptop
- `ssh <your-ip>` (port 22) fails — your real SSH server is off
- The hotspot survives 10+ minutes without dropping

### Kill switch

`Ctrl-C` the honeypot. Nothing else is exposed, so that's the whole blast
radius.

### Other options, and why not

- **Venue Wi-Fi** — policy problem plus client isolation. Covered above.
- **ngrok / Cloudflare Tunnel** — technically works and needs no shared
  network, but it publishes an any-password SSH service to the open internet.
  Real scanners find that within minutes and will hammer an LLM you're paying
  for. Avoid.

---

### Command classification logs

Install the honeypot dependencies with `pip install -r requirements.txt` and
place the trained model at `models/attack_classifier.joblib`. Use the same
scikit-learn version used to train the artifact. The classifier loads once,
on the first command.

Each nonempty shell command (including `exit`) appends a JSON object to
`logs/commands.jsonl`. Set `COMMAND_LOG_PATH` to override the destination.
Records include UTC `ts`, `session_id`, `src_ip`, `node_id`, `protocol`, `type`,
`command`, `response`, integer `severity`, and numeric `confidence`.
If classification fails, severity and confidence are null and
`classification_error` is `classification_failed`; the shell continues.
Local logging is independent of backend delivery. Predictions and session flags
are also sent to the collector and persisted in SQLite. Logs are gitignored.

Sessions are flagged for review after one severity >=3 prediction with
confidence >=0.70, or three severity >=2 predictions among the last five
commands (regardless of confidence). A severity >=4 prediction with confidence
>=0.70 raises priority to `high`. Failed predictions count toward the window
but do not count as suspicious. Flags persist until the session ends and
priority never decreases; SSH interactions continue after flagging.
Each command record includes `session_flagged`, `session_newly_flagged`,
`session_priority` (`review`, `high`, or null), and `session_flag_reason`.
These are provisional thresholds pending validation against labeled sessions.

When a session reaches `high` priority, its triggering command and every
subsequent submitted command are also appended to
`logs/high_severity_sessions.jsonl` (override with `MONITOR_LOG_PATH`).
Records include the authenticated SSH `username`, source IP (`src_ip`),
`session_id`, command input, response, timestamp, and prediction/flag fields.
Monitoring continues even if later predictions fail or have low severity.
Flagging never disconnects the client; a client can still exit or disconnect
normally. Review-priority sessions remain in the main command log only.

Run policy and logging tests with:
`python3 -m unittest test_session_risk test_command_logging -v`.

---

## Rules for this repo

This repo is **public**. Before every commit run `git status` and confirm none
of these appear:

- **`keys/`** — SSH private keys. Regenerate with `./gen-keys.sh`; never commit.
- **`.env`** — holds the collector token and any LLM API key. Only
  `.env.example` is committed.
- **`*.db`, `data/`** — the capture database holds real attacker IPs and live
  malware URLs.
- **`.venv/`, `node_modules/`** — regenerable, and huge.

All of the above are in `.gitignore`. Note that gitignore does **not** apply to
files already tracked — if something slipped in, untrack it:

```bash
git rm --cached <path>
git commit -m "Untrack <path>"
```

...and rotate whatever leaked.

---

## Known gaps

- **No NVIDIA GPU on the dev laptop** (AMD HawkPoint iGPU, 14 GB shared RAM).
  Unsloth does support AMD RDNA 3 on Linux now, but on an integrated GPU with
  shared memory the ROCm/PyTorch version pinning is a bad use of hackathon
  hours. **Fine-tune in Google Colab (free T4), download the adapter or GGUF,
  run inference locally on CPU.** PyTorch for the session clustering is fine on
  CPU and needs no ROCm.
- `base_server.py` only accepts `user`/`password`. A honeypot should accept any
  credentials and log what was tried.
- `base_server.py` accepts concurrent connections with a worker per connection.
  Each has independent authentication, fake filesystem, and risk state. Shared
  MLX response generation is serialized; other sessions can continue using
  simulated filesystem commands while generation runs.
- No root `requirements.txt` yet; `pip install paramiko` by hand for now.

### Severity in the API and dashboard

Restart the collector and honeypot after updating. Collector startup adds risk
columns to existing databases without deleting recorded sessions. Older events
without prediction fields remain accepted; existing records are not reclassified.
The collector stores predictions supplied by the honeypot; it does not run the
classifier itself.

`GET /sessions` and `GET /sessions/{id}` include `username`, maximum observed
`severity`, `session_flagged`, `session_priority`, and `session_flag_reason`.
Flags persist after logout and priority never decreases. `/events` and
`/sessions/{id}/events` include per-command prediction and flag fields; input
entries in the session replay include predictions too. `/stats` includes
`flagged_sessions` and `high_priority_sessions` across active and closed sessions.

The Transmissions page provides a Flagged filter and Risk column. Session details
show username, priority, flag reason, maximum severity, and per-input predictions.
No flag closes an SSH session. Local logs remain available if collector delivery
fails; failed event delivery is not retried automatically.

Backend integration tests (use your backend Python environment):
`python -m unittest backend.test_risk_api -v`.
Set `HONEYPOT_DB_PATH` to override the collector database path.
