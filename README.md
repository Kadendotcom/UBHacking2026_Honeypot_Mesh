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
| `PLAN.md` | Backend build order | — |

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
# 1. Honeypot — listens on 127.0.0.1:2222
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
ssh user@127.0.0.1 -p 2222        # password: password
```

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
- `base_server.py` handles one connection at a time — needs a thread per
  connection before two people can connect at once.
- No root `requirements.txt` yet; `pip install paramiko` by hand for now.
