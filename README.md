# Honeypot Mesh — UB Hacking 2026

An SSH honeypot that pretends to be a real Linux server. Attackers log in and get a convincing shell. 
- every command is **logged** and **scored for severity** by an ML classifier
- risky sessions are **flagged** automatically
- unusual commands get realistic output from a **fine-tuned LLM**
- everything shows up on a **live dashboard**

**Nothing an attacker types is ever executed.** The honeypot only returns text.

## How it works

```
attacker ──ssh──▶ base_server.py ──events──▶ backend (FastAPI + SQLite) ──▶ frontend dashboard
                      │
                      ├─ fake filesystem for ls / cd / cat / pwd
                      ├─ fine-tuned LLM for everything else
                      └─ severity classifier + session risk flags
```

| Path | What it is |
|---|---|
| `base_server.py` | The SSH honeypot (Paramiko) |
| `fake_session.py` | Fake filesystem and shell state per session |
| `model_inference.py` | LLM responses for commands the fake shell doesn't handle |
| `attack_classifier.py`, `train_classifier.py` | Command severity classifier (scikit-learn) |
| `session_risk.py` | Rules that flag suspicious sessions |
| `backend/` | Collector API that stores sessions and events |
| `frontend/` | React + Vite + Tailwind dashboard |
| `setup.sh` | One-command setup |

## Setup

You need **Python 3.11+**, **Node 20+**, and **OpenSSH** (`ssh-keygen`).

```bash
git clone https://github.com/Kadendotcom/UBHacking2026_Honeypot_Mesh.git
cd UBHacking2026_Honeypot_Mesh
./setup.sh
```

`setup.sh` generates SSH host keys, creates the Python environments, installs
all dependencies and creates `backend/.env`. You can run it again safely, and
you should after every `git pull`.

Two files aren't in the repo:

- `mlx-8bit/`: the fine-tuned LLM. It runs on **Apple Silicon Macs only** (MLX).
- `models/attack_classifier.joblib`: the trained classifier. You can also
  build it with `train_classifier.py`.

## Run it

Use three terminals:

```bash
# 1. Honeypot (127.0.0.1:2222)
source .venv/bin/activate && python base_server.py

# 2. Collector API (http://127.0.0.1:8000/docs)
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# 3. Dashboard (http://localhost:5173)
cd frontend && npm run dev
```

Then connect as an attacker would:

```bash
ssh root@127.0.0.1 -p 2222    # any username, any password
```

## Risk flagging

Each command gets a severity (0–4) and a confidence score. A session is flagged when:

- **Review:** one command has severity ≥ 3 at ≥ 70% confidence, or three of the
  last five commands have severity ≥ 2
- **High:** one command has severity ≥ 4 at ≥ 70% confidence

Flags never disconnect the attacker. A session's priority can only go up.
Commands are logged to `logs/commands.jsonl`, and high-priority sessions also
go to `logs/high_severity_sessions.jsonl`.

## Demo on another laptop

The honeypot only listens on `127.0.0.1` by default. To let a judge connect,
put both laptops on **your own phone hotspot** (not campus Wi-Fi) and run:

```bash
HONEYPOT_HOST=0.0.0.0 python base_server.py
```

The startup banner prints the exact `ssh` command to share. Only the honeypot
port is exposed. The API and dashboard stay on localhost. Press `Ctrl-C` to
shut it off.

Don't expose it to the public internet with ngrok or a tunnel. Scanners will
find it within minutes.

| Variable | Default | Purpose |
|---|---|---|
| `HONEYPOT_HOST` | `127.0.0.1` | Set to `0.0.0.0` to accept connections from the network |
| `HONEYPOT_PORT` | `2222` | SSH port |
| `MAX_SESSIONS` | `5` | Max concurrent connections |

## Tests

```bash
python3 -m unittest test_session_risk test_command_logging -v
python -m unittest backend.test_risk_api -v     # from the backend venv
```


## Still to do

- Session clustering into attacker archetypes (`ml/`)
- Severity thresholds still need tuning against labeled sessions
