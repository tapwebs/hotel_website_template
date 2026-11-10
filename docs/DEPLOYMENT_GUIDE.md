# Dream Heaven's — Live Production Deployment Guide

This guide details the complete process for deploying the Dream Heaven's platform:
- **Backend & PostgreSQL Database**: Hosted on **Hostinger VPS** managed via **Coolify**.
- **Public Website & Staff Console**: Hosted on **Hostinger Web Hosting (`public_html`)**.

---

## 1. Architecture & Domain Mapping

```
                                  INTERNET
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           │                                                   │
  [Hostinger Web Hosting]                             [Hostinger VPS (Coolify)]
   (Apache / LiteSpeed)                                  (Traefik Reverse Proxy)
           │                                                   │
   ├── example.com                            ├── api.example.com
   │   (Public Website: public_html/)                  │   └── website-api container (Port 3001)
   │                                                   │
   └── hms.example.com                        ├── hms-api.example.com
       (Staff HMS Console: public_html/hms/)           │   └── hms-api container (Port 8001)
                                                       │
                                                       └── postgres:16 container (Internal Network)
```

---

## 2. Part 1: Hostinger VPS via Coolify (Backends & Database)

### Step 1.1: Deploy Docker Compose Stack in Coolify
In the Coolify dashboard (`http://<your-vps-ip>:8000`):
1. Create a new **Project** (e.g., `Dream Heavens`).
2. Add a new **Resource** > **Docker Compose**.
3. Select your Git repository or paste the contents of `docker-compose.prod.yml`.

### Step 1.2: Configure Environment Variables in Coolify
Set the following environment variables in the Coolify stack configuration:

| Variable | Description | Recommended Production Value |
|---|---|---|
| `POSTGRES_USER` | PostgreSQL user | `hdh_admin` |
| `POSTGRES_PASSWORD` | Strong PostgreSQL password | *(generate 32+ random characters)* |
| `POSTGRES_DB` | PostgreSQL database name | `hotel_dream_heavens` |
| `HMS_SECRET_KEY` | JWT secret key for HMS staff tokens | *(generate 64+ random hex characters)* |
| `SHARED_INTEGRATION_KEY` | Shared secret key between HMS & Website API | *(generate 64+ random hex characters)* |
| `ALLOWED_ORIGIN` | Public website origin | `https://example.com` |
| `SITE_URL` | Public canonical URL | `https://example.com` |
| `TRUST_PROXY` | Proxy header trust | `1` *(mandatory behind Coolify Traefik)* |

`HMS_SECRET_KEY` and `SHARED_INTEGRATION_KEY` are **required**: the compose file refuses to start without them, and the API refuses a `SECRET_KEY` containing `change_me` or `dev`. Online payments: set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` on `hms-api` to enable guest QR online payment (independent of `PAYMENT_PROVIDER`, which only selects the front-desk ledger gateway: `demo`, `razorpay` or `bank`).

Template with every variable: [`.env.production.example`](../.env.production.example) (plus `backend/.env.production.example` and `backend/website/.env.production.example`). `docker-compose.prod.yml` already sets `APP_ENV=production` and `ENABLE_DEMO_SEED=false`.

### Step 1.3: Set Domain Routing in Coolify
Under each service settings in Coolify:
- **`website-api`**: Assign FQDN `https://api.example.com`.
- **`hms-api`**: Assign FQDN `https://hms.example.com` (or keep private if accessed via reverse proxy gateway).
- Coolify automatically issues and renews Let's Encrypt SSL certificates.

### Step 1.4: Run Database Migrations & Initial Setup
The containers automatically execute schema migrations on startup:
- `hms-api` executes `alembic upgrade head`.
- `website-api` executes `node dist/scripts/migrate.js`.

**HMS staff accounts and rooms (first deploy, or after a reset).** Production has no demo accounts. In the HMS backend terminal in Coolify, create the staff accounts file (format: `backend/app/seed/users.example.json`) and run:
```bash
python -m backend.app.seed.production_bootstrap --users /tmp/users.json          # dry run, lists rows
python -m backend.app.seed.production_bootstrap --users /tmp/users.json --apply \
    --rooms DLX_PALACE=<room numbers> --rooms ROYAL_SUITE=<room numbers>          # DELETES all HMS rows first: back up first
rm /tmp/users.json
```
Add rooms later, safely: `python -m backend.app.seed.production_setup --rooms ROYAL_SUITE=311-312`. Then enter the GSTIN under Settings > Property.

To create an initial staff administrator account on the website API, run inside the `website-api` terminal in Coolify:
```bash
node dist/scripts/create-admin.js "admin@example.com" "Admin User" "YourSecurePassword123"
```

---

## 3. Part 2: Hostinger Web Hosting (`public_html`)

The public hotel website is a pre-rendered static build with instant hydration and zero server overhead.

### Step 2.1: Build Frontends Locally

```bash
# 1. Build Public Guest Website
cd frontend/website
# Ensure production API URL is configured if building with remote API:
export VITE_AUTH_API_URL="https://api.example.com"
npm run build
# Verified output is placed in: frontend/website/dist/

# 2. Build Staff HMS Console
cd ../hms
# On *.example.com the console calls https://api.example.com/api/v1 by default;
# set VITE_API_BASE_URL only if the API lives elsewhere (see frontend/hms/.env.production.example).
export VITE_SITE_URL="https://example.com"
npm run build
# Verified output is placed in: frontend/hms/dist/ (includes .htaccess and robots.txt)
```

### Step 2.2: Upload Public Website to Hostinger `public_html`
1. Open Hostinger **hPanel** > **Websites** > **Dashboard** > **File Manager**.
2. Navigate to `domains/example.com/public_html/`.
3. Upload all contents of `frontend/website/dist/` directly into `public_html/`:
   - `index.html`
   - `rooms/`, `dining/`, `weddings-events/`, `gallery/`, `about/`, `contact/`, etc.
   - `assets/` (hashed CSS, JS, fonts)
   - `images/` (optimized WebP/AVIF imagery)
   - `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`
   - **Crucial**: Ensure hidden `.htaccess` file is uploaded (Enable *Show hidden files* in File Manager).

### Step 2.3: Upload Staff HMS Console
- **Subdomain**: `hms.example.com`:
  - In hPanel, go to **Domains** > **Subdomains** > create `hms`.
  - Set folder name to `hms` (`/public_html/hms/`).
  - Upload contents of `frontend/hms/dist/` (including the hidden `.htaccess`) directly into `domains/example.com/public_html/hms/`.

---

## 4. Part 3: DNS Records Configuration

In Hostinger DNS Zone Editor for `example.com`:

| Type | Name | Content / Target | Purpose |
|---|---|---|---|
| `A` | `@` | *[Hostinger Web Hosting IP]* | Main website (`example.com`) |
| `CNAME` | `www` | `example.com` | WWW redirect to apex |
| `A` | `hms` | *[Hostinger Web Hosting IP]* | Staff HMS Console (`public_html/hms`) |
| `A` | `api` | *[Hostinger VPS IP]* | Fastify Website API (`api.example.com`) |
| `A` | `hms-api` | *[Hostinger VPS IP]* | FastAPI HMS API (`hms-api.example.com`) |

---

## 5. Part 4: Rate Limiting & Security Verifications

Before marking live, verify the rate limiting policies implemented across the services:

1. **Staff Login Protection (`/api/v1/auth/login`)**:
   - Limit: Max 10 attempts per 5 minutes per IP; 5 attempts per 15 minutes per username.
   - Failed attempts consume budget; successful authentication refunds the slot.
   - Exceeding limit returns `HTTP 429 Too Many Requests` with `Retry-After`.
2. **Reverse Proxy Real IP Detection**:
   - Real client IPs are resolved from `X-Forwarded-For` / `X-Real-IP`.
   - Prevents all guests from sharing the Docker/Traefik reverse proxy IP.
3. **Room Inventory Hold Spam Protection (`/api/v1/availability/hold`)**:
   - Limit: Max 10 holds per 10 minutes per IP.
   - Protects live room inventory from automated exhaustion attacks.
4. **Website API Proxy Enforcement (`TRUST_PROXY=1`)**:
   - Configured in `docker-compose.prod.yml` to safely accept forwarded headers from Traefik.
5. **Content Security Policy**:
   - Active in `.htaccess` on `public_html`: allows connections to `https://api.example.com` while protecting from cross-site injection.

---

## 6. Post-Deployment Smoke Tests

Run these quick checks after uploading:

```bash
# 1. Verify Public Website returns 200 with security headers
curl -sI https://example.com | grep -E "HTTP/|content-security-policy|strict-transport-security"

# 2. Verify Sitemap, Robots, and LLM endpoints
curl -sI https://example.com/sitemap.xml | grep "HTTP/"
curl -sI https://example.com/robots.txt | grep "HTTP/"
curl -sI https://example.com/llms.txt | grep "HTTP/"

# 3. Verify Website API Health
curl -s https://api.example.com/health

# 4. Verify HMS API Health
curl -s https://hms.example.com/health
```
