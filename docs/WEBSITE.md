# Hotel Dream Heavens

Website for Hotel Dream Heavens, split into two parts.

| Folder | What |
|---|---|
| `frontend/` | Vite + React static site, prerendered. See [frontend/README.md](frontend/README.md). |
| `backend/` | Minimal auth API (signup/login), Node + TypeScript. See [backend/README.md](backend/README.md). |
| `docs/` | Deploy guide and product docs ([docs/DEPLOY.md](docs/DEPLOY.md)). |
| `images/` | All source images in one folder: real photos by area, plus `ai-generated/`. Index in `images/MANIFEST.md`. Read by `frontend` `npm run images` and `npm run icons`. |
| `.kiro/`, `.agents/` | Design plans and working notes. |

Requires Node 24 (see `.nvmrc`).

```bash
# frontend
cd frontend && npm ci && npm run dev

# backend (separate terminal)
cd backend && cp .env.example .env && npm ci && npm run dev
```

To use the backend locally, set `VITE_AUTH_API_URL=http://localhost:3001` in `frontend/.env`.

CI (`.github/workflows/ci.yml`) typechecks, lints, tests and builds both parts on every push and PR to `main`. Env vars are documented in each folder's `.env.example`.
