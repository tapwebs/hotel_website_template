#!/usr/bin/env bash
# Starts the whole platform for local development. Ctrl+C stops everything.
#   HMS API      http://127.0.0.1:8001   (FastAPI)
#   HMS app      http://localhost:5174   (/app, /dine/<token>)
#   Website API  http://127.0.0.1:3001   (Fastify; needs Postgres, see backend/website/.env)
#   Website      http://localhost:5173
set -u
cd "$(dirname "$0")/.."
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"   # website API needs Node 24 (see .nvmrc)
pids=()
run() { local name=$1 dir=$2; shift 2; (cd "$dir" && exec "$@" 2>&1 | sed -u "s/^/[$name] /") & pids+=($!); }
trap 'kill "${pids[@]}" 2>/dev/null; pkill -P $$ 2>/dev/null; exit 0' INT TERM
run hms-api  .                backend/.venv/bin/uvicorn backend.app.main:app --port 8001 --reload --reload-dir backend/app
run hms      frontend/hms     npx vite --port 5174
run site-api backend/website  npm run dev
run site     frontend/website npx vite --port 5173
wait
