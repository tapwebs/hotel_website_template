#!/usr/bin/env bash
# One command to verify everything: types, tests and builds for the HMS and the website. Stops at the first failure.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
step() { printf '\n== %s\n' "$1"; }
step "HMS api: pytest";        (cd backend && .venv/bin/python -m pytest tests -n auto -q 2>&1 | tail -2)
step "HMS app: tsc + build";   (cd frontend/hms && npx tsc -b && npm run build --silent >/dev/null)
step "Website api: tsc + tests"; (cd backend/website && npm run typecheck --silent && npm test --silent 2>&1 | grep -E "^ℹ (tests|pass|fail)")
step "Website: tsc + tests + build"; (cd frontend/website && npm run typecheck --silent && npm test --silent -- --run 2>&1 | grep -E "Tests |Test Files" && npm run build --silent >/dev/null)
printf '\nAll checks passed.\n'
