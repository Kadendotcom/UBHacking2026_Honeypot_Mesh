#!/usr/bin/env bash
# One-shot dependency setup for the Honeypot Mesh. Safe to re-run after every `git pull`.
#   ./setup.sh
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$*"; exit 1; }
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

step "System tools"
command -v python3 >/dev/null || die "python3 not found (need 3.11+)"
python3 -c 'import sys; sys.exit(sys.version_info < (3,11))' \
  || die "Python $(python3 -V | cut -d' ' -f2) is too old — need 3.11+"
ok "python3 $(python3 -V | cut -d' ' -f2)"
command -v node >/dev/null || die "node not found (need 20+)"
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "Node $(node -v) too old — need 20+"
ok "node $(node -v)"
command -v npm >/dev/null || die "npm not found"
ok "npm $(npm -v)"
command -v ssh-keygen >/dev/null || die "ssh-keygen not found (install OpenSSH client)"
ok "ssh-keygen"

step "SSH host keys"
if [ -f keys/server_rsa ] && [ -f keys/server_ecdsa ] && [ -f keys/server_ed25519 ]; then
  ok "keys/ present"
else
  mkdir -p keys
  rm -f keys/*                      # gen-keys.sh's ssh-keygen prompts if files exist
  bash gen-keys.sh
  ok "generated keys/"
fi

step "Honeypot venv (.venv)"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
ok "installed requirements.txt"
if [ "$(uname -s)-$(uname -m)" != "Darwin-arm64" ]; then
  warn "mlx-lm only runs on Apple Silicon — model_inference.py won't load on this machine"
fi
if [ -d mlx-8bit ]; then
  ok "model found at mlx-8bit/"
else
  warn "mlx-8bit/ model dir missing — base_server.py needs it (gitignored; get it from a teammate)"
fi

if [ -f models/attack_classifier.joblib ]; then
  ok "classifier found at models/attack_classifier.joblib"
elif [ -f data/curated.jsonl ]; then
  mkdir -p models
  .venv/bin/python download_dataset.py >/dev/null
  .venv/bin/python train_classifier.py >/dev/null
  ok "trained models/attack_classifier.joblib from data/curated.jsonl"
else
  warn "models/attack_classifier.joblib missing — base_server.py needs it (gitignored)."
  warn "  Get the .joblib from a teammate, or put data/curated.jsonl here and re-run ./setup.sh to train it"
fi

step "Backend venv (backend/.venv)"
[ -d backend/.venv ] || python3 -m venv backend/.venv
backend/.venv/bin/pip install -q --upgrade pip
backend/.venv/bin/pip install -q -r backend/requirements.txt
ok "installed backend/requirements.txt"
if [ ! -f backend/.env ]; then
  TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
  sed "s/^COLLECTOR_TOKEN=.*/COLLECTOR_TOKEN=$TOKEN/" backend/.env.example > backend/.env
  ok "created backend/.env with a fresh COLLECTOR_TOKEN"
else
  ok "backend/.env exists"
fi
mkdir -p backend/data

step "Frontend (frontend/node_modules)"
(cd frontend && npm ci --no-audit --no-fund --loglevel=error)
ok "npm ci done"

step "Done"
cat <<MSG
Run the stack (3 terminals):
  source .venv/bin/activate && python base_server.py
  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
  cd frontend && npm run dev
MSG
