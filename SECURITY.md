# Security Architecture, Audit Findings & Production Hardening Guide

## 1. Executive Summary & Audit Overview

A comprehensive security audit and follow-up performance verification was executed across the TapMenu Open Hospitality Platform (HMS FastAPI backend, Website Fastify backend, Staff frontend, and Public Website frontend).

All critical and high-priority code vulnerabilities were resolved, verified with automated test suites, and audited against the OWASP Top 10 API Security standard.

---

## 2. Vulnerability Findings & Remediation Matrix

| Severity | Category | Vulnerability Description | Status | Remediation Details |
| :--- | :--- | :--- | :--- | :--- |
| **CRITICAL** | Auth & Access | Shared Hotel Wi-Fi Lockout via IP-only Rate Limiting | **FIXED** | Re-keyed login rate limiting to dual-key `IP + Username` (15 attempts/5m), with a separate strict per-account lockout (5 attempts/15m) and an IP burst ceiling (60 attempts/5m). Staff on shared Wi-Fi can no longer lock each other out. |
| **CRITICAL** | Spoofing | Unchecked `X-Forwarded-For` Header Spoofing | **FIXED** | Client IP determination in `backend/app/core/ratelimit.py` now inspects the direct peer socket (`request.client.host`). `X-Forwarded-For` is trusted **only** when incoming traffic originates from loopback or trusted private subnets (`TRUST_PROXY=True`). Untrusted spoofed headers are rejected or ignored. |
| **CRITICAL** | IDOR & Tenant | Cross-Property / Cross-Tenant Data Access Risk | **FIXED** | Strict default-deny tenant enforcement via `get_property_context` in `dependencies.py`. Master folios, housekeeping tasks, maintenance tickets, and POS orders strictly filter on validated `property_id`. Guest profile endpoints enforce `GuestProfile.org_id == current_user.org_id`. |
| **HIGH** | Data Integrity | Duplicate Charges / Payments on Network Retries | **FIXED** | Added support for `X-Idempotency-Key` headers on folio charges (`POST /api/v1/folios/charges`) and settlement payments (`POST /api/v1/folios/payments`), mapped to unique reference checks to prevent duplicate ledger postings. |
| **HIGH** | Performance / DoS | N+1 Database Query Amplification | **FIXED** | Refactored all list queries across folios, housekeeping, maintenance, and guest services from loops into batch queries (`in_()`). Measured query count tests confirm $O(1)$ query execution regardless of list size. |
| **HIGH** | Secrets / Config | Accidental Leakage of Secrets via Git Tracking | **FIXED** | Hardened `.gitignore` to strictly exclude all `.env`, `.env.local`, SQLite databases (`tapmenu_hms.db`), and cache files while whitelisting `.env.example` templates and source assets (`src/lib`). Verified via `git status`. |
| **MEDIUM** | Stale Data | Frontend Client Cache Serving Outdated Room/Folio States | **FIXED** | In `frontend/staff/src/services/apiServices.ts`, live operational endpoints (`/rooms`, `/housekeeping`, `/maintenance`, `/folios`, `/pos/orders`) have TTL reduced to 2.5 seconds. The entire client cache is automatically invalidated on `logout()` and `switchProperty()`. |
| **MEDIUM** | Client Exhaustion | Unbounded Kitchen / POS Background Polling | **FIXED** | Configured `refetchIntervalInBackground: false` and dynamic visibility backoff in `KitchenPage.tsx` and `PosPage.tsx`. Polling pauses or drops to 30s when the browser tab is hidden/inactive. |
| **MEDIUM** | Database Speed | Missing Database Indexes on Foreign Keys and Status Columns | **FIXED** | Created Alembic migration `d9e0f1a2b3c4` adding indexes on `master_folios(stay_id)`, `housekeeping_tasks(property_id, status)`, `maintenance_tickets(property_id, status)`, and `menu_items(property_id, is_active, is_available)`. Verified with `EXPLAIN QUERY PLAN`. |
| **MEDIUM** | Resilience | Third-Party Google API Latency & Network Jitter | **FIXED** | Integrated `fetchWithRetry()` with exponential backoff, jitter, and request timeouts in `backend/website/src/integrations/google.ts`. Cached Google OAuth bearer tokens until expiry. |
| **LOW** | Injection | Missing Security Headers on API Responses | **FIXED** | Configured `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Content-Security-Policy: default-src 'self'; frame-ancestors 'none';` across both FastAPI and Fastify backends. |
| **MANUAL** | Database Privilege | Database User Least Privilege | **MANUAL ACTION** | Production PostgreSQL user must not be `SUPERUSER`. Limit role privileges to `SELECT, INSERT, UPDATE, DELETE` on the application schema. |
| **MANUAL** | Secret Rotation | Secret Generation for Production Deployment | **MANUAL ACTION** | Generate strong 32-byte hex secrets for `SECRET_KEY`, `COOKIE_SECRET`, and `HMS_INTEGRATION_API_KEY` before pointing live domains. |

---

## 3. Worker Architecture & Scaling Assumptions

### Single-Worker Mode (Current Default)
- Both the **HMS API** (Uvicorn) and **Website API** (Node Fastify) are deployed as single-worker/single-process container instances (e.g., standard Coolify container setups on Hostinger VPS).
- In this architecture, in-process rate limiting (sliding window token buckets) and in-memory TTL caching with FIFO max-entry eviction (`MAX_CACHE_ENTRIES = 250` on client, single-flight deduplication) are completely safe, low-latency, and zero-dependency.

### Multi-Worker / Horizontal Replica Scale-Out (Redis Migration Path)
If scaling out to multiple Uvicorn workers (`--workers N > 1`) or multiple container replicas behind a load balancer:
1. **Rate Limiting**: Swap in-memory `counters` in `backend/app/core/ratelimit.py` and `backend/website/src/app.ts` with Redis-backed sliding window counters (`redis-py` / `ioredis`).
2. **Operational Caches**: Direct POS menu, room categories, and Google analytics caches to shared Redis instances with standard TTL key expiration.
3. **Session Revocation**: Synchronize JWT token version / user revocation signals via Redis pub/sub.

---

## 4. Production Security Checklist (Step-by-Step Manual Actions)

Before routing live production DNS or taking guest payments:

### Step 1: Environment Variables & Secret Generation
Generate high-entropy cryptographically secure secrets:
```bash
# Generate 32-byte hex tokens
openssl rand -hex 32  # Use for SECRET_KEY in backend/.env
openssl rand -hex 32  # Use for COOKIE_SECRET in backend/website/.env
openssl rand -hex 32  # Use for HMS_INTEGRATION_API_KEY in both .envs
```

### Step 2: Reverse Proxy & Header Trust
When hosting on Hostinger VPS behind Coolify / Traefik / Nginx:
- In `backend/.env`:
  ```ini
  APP_ENV=production
  DEBUG=false
  TRUST_PROXY=true
  TRUSTED_PROXIES=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
  ```
- In `backend/website/.env`:
  ```ini
  TRUST_PROXY=true
  ALLOWED_ORIGIN=https://hoteldreamheavens.in
  ```

### Step 3: Database Connection Pooling & Least Privilege
- In `backend/.env`:
  ```ini
  POSTGRES_POOL_SIZE=20
  POSTGRES_MAX_OVERFLOW=10
  ```
- In `backend/website/.env`:
  ```ini
  POSTGRES_POOL_SIZE=20
  POSTGRES_IDLE_TIMEOUT_MS=30000
  ```
- Configure PostgreSQL role permissions:
  ```sql
  REVOKE ALL ON SCHEMA public FROM PUBLIC;
  GRANT USAGE, CREATE ON SCHEMA public TO hms_app_user;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hms_app_user;
  ```

### Step 4: Run Migrations
```bash
# HMS Core migrations (applies performance and composite indexes)
(cd backend && .venv/bin/alembic upgrade head)

# Website database migrations
(cd backend/website && npm run migrate)
```

### Step 5: Verify HTTPS & Security Headers
Verify that your reverse proxy terminates TLS with HTTP/2 and sends:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- TLS v1.2 / v1.3 only (disable TLS v1.0 and v1.1)
