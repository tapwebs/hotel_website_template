# TAPWEBS — Pre-Publication GitHub Security & Sensitive Information Audit Report

**Target Repository:** `HOTEL_DREAM_HEAVENS_PROJECT`  
**Auditor:** Senior Application Security Engineer & DevSecOps Lead  
**Audit & Remediation Date:** November 17, 2026  
**Repository Branch:** `main`  
**Current Commit Head:** `533c23d`  
**Total Tracked Files Audited:** 1,739 files  
**Total Git Commits Scanned:** 6 commits (full commit patch history: 7,212,475 characters)  
**Publication Target Identity:** **TapMenu — Open Hospitality Platform**  

---

## 1. Executive Security Summary

A comprehensive, zero-trust security and privacy audit was performed on the `HOTEL_DREAM_HEAVENS_PROJECT` repository to determine its readiness for public hosting and open-source release on GitHub. 

Following the initial audit, all five approved remediation items were implemented, verified, and regression-tested across the FastAPI core backend, Fastify website API, Vite/React HMS staff portal, and Vite/React marketing website.

### Posture Overview
| Metric | Audit Assessment | Post-Remediation Status |
| :--- | :--- | :--- |
| **Active Live Secrets (Cloud / Payment / DB)** | **CLEAN** — 0 live AWS, GCP, Stripe, Razorpay, or production DB passwords. | **VERIFIED CLEAN** |
| **Private Keys & TLS Certificates** | **CLEAN** — 0 `.pem`, `.key`, or RSA/EC private keys in working tree or git history. | **VERIFIED CLEAN** |
| **Git Commit History Leakage** | **CLEAN** — Full patch analysis of all 6 commits verified zero unredacted secrets. | **VERIFIED CLEAN** |
| **Malicious Code / Telemetry / Miners** | **CLEAN** — No obfuscated scripts, backdoor accounts, or outbound beacons. | **VERIFIED CLEAN** |
| **Default Secret Hardening** | Static dev secret accepted in non-prod environments. | **RESOLVED** — Strict validation in all non-dev/test environments. |
| **Demonstration Seed Data PII** | Realistic Indian phone numbers, emails, and UPI ID. | **RESOLVED** — Anonymized to dummy `+91 98765 0000X`, `@example.com`. |
| **Information Disclosure in Health Check** | Exception details `str(e)` reflected in `/health/ready`. | **RESOLVED** — Generic error returned; internal diagnostics logged safely. |
| **Docker Container Execution** | Container ran Uvicorn as `root`. | **RESOLVED** — Dedicated non-root `appuser` (UID 10001) added. |
| **Residual Legacy Script Defaults** | Legacy `dreamheavens` and `dh_db_` fallbacks in backup scripts. | **RESOLVED** — Updated to `open_hospitality_db` and `tapmenu_db_`. |

**Final Publication Verdict:** **`SAFE TO PUSH`**  
All identified security and privacy risks have been remediated. The codebase contains zero secrets, zero customer/guest PII, hardened container configurations, safe error handling, and strict environment validation.

---

## 2. Repository Scope Inspected

The audit and remediation encompassed the full repository structure across all layers:

```
HOTEL_DREAM_HEAVENS_PROJECT/
├── backend/
│   ├── app/
│   │   ├── api/routes/          # 23 FastAPI routers (auth, reservations, folios, dining, QR, POS)
│   │   ├── core/                # Configuration, async database engine, security, error handlers
│   │   ├── models/              # SQLAlchemy models (multi-tenant, property-isolated)
│   │   ├── schemas/             # Pydantic validation schemas
│   │   ├── services/            # Payment gateway, notification, receipt, and booking services
│   │   └── seed/demo_seed.py    # Demonstration mock database population script
│   ├── migrations/              # Alembic database migrations (PostgreSQL / SQLite)
│   ├── tests/                   # Pytest test suite (unit, integration, concurrency)
│   ├── website/                 # Fastify Node.js microservice for guest identity & QR hub
│   └── Dockerfile               # Python 3.12-slim production container (non-root hardened)
├── frontend/
│   ├── hms/                     # Staff & Operations Portal (React 19, Tailwind CSS, Vite)
│   └── website/                 # Public Marketing & Booking Website (React 19, SSR/Prerender, Three.js)
├── scripts/                     # Operational automation (backup-db.sh, restore-db.sh, dev.ps1, k6)
├── docs/                        # Architecture specifications and deployment guidelines
├── .github/workflows/           # GitHub Actions CI pipeline (ci.yml)
├── docker-compose.prod.yml      # Production container composition
└── .gitignore                   # Version control ignore rules
```

---

## 3. Secret and Credential Exposure Findings

An exhaustive automated regex scan paired with manual code auditing was performed against all 1,739 tracked files, untracked local files, and environment templates.

### 3.1. Cloud, Database & Infrastructure Credentials
- **AWS / GCP / Azure Keys:** **PASS**. No access key IDs, service account keys, or storage credentials committed.
- **Production Database URLs:** **PASS**. Production configuration is strictly parameterized via environment variables (`${DATABASE_URL}`, `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`).
- **Local SQLite Artifacts:** SQLite database file `backend/tapmenu_hms.db` is present on disk for local testing, confirmed untracked and excluded by `.gitignore`.
- **Certificates & Keys:** **PASS**. Zero `.pem`, `.key`, `.crt`, `.pfx`, or SSH keys present in the repository.

### 3.2. Authentication Tokens & Secrets
- **SEC-01: Fallback JWT `SECRET_KEY` in `backend/app/core/config.py` — `RESOLVED`**
  - **Previous State:** The validator `validate_secret_key` raised a `ValueError` only when `APP_ENV == "production"`. Staging or unspecified environments accepted the static fallback.
  - **Remediation:** Validator now enforces that any environment outside of `("development", "test")` strictly rejects keys with default markers (`dev`, `change_me`, `secret`, `password`, `tapmenu_hms_jwt`, `default`, `example`) or lengths under 32 characters.
  - **Verification:** Unit tests confirmed rejection across `staging`, `production`, and weak keys, while preserving convenient defaults for `development` and `test`.

- **SEC-02: Default Superadmin Guard in `backend/app/seed/demo_seed.py` — `RESOLVED`**
  - **Previous State:** `seed_demo_data()` could theoretically be triggered in production if misconfigured.
  - **Remediation:** Added an explicit runtime guard:
    ```python
    if settings.APP_ENV == "production":
        raise RuntimeError("Demo seed execution is strictly prohibited in production environment.")
    ```
  - **Verification:** Mock test verified that executing `seed_demo_data()` under `APP_ENV="production"` immediately raises `RuntimeError`.

### 3.3. Payment Gateway & Third-Party APIs
- **Razorpay / Stripe Keys:** **PASS**. All Razorpay keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) are empty defaults (`Optional[str] = None`) loaded strictly from environment variables.
- **WhatsApp Cloud API & MSG91:** **PASS**. `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, and `MSG91_AUTH_KEY` are unset placeholders.
- **Turnstile Captcha:** **PASS**. `TURNSTILE_SECRET_KEY` defaults to `None`.
- **Google OAuth:** **PASS**. Decoupled and completely removed in commit `533c23d`.

### 3.4. Guest PII & Data Privacy
- **SEC-03: Realistic Indian Contact Numbers & External Emails in `demo_seed.py` — `RESOLVED`**
  - **Previous State:** Realistic numbers (`+91 98201...`, `+91 97112...`), external domains (`@gmail.com`, `@techcorp.in`), and live bank UPI format (`@okhdfcbank`).
  - **Remediation:** Replaced with standard fictitious templates:
    - `phone="+91 98765 00001"`, `email="guest.sharma@example.com"`
    - `phone="+91 98765 00002"`, `email="guest.chawla@example.com"`
    - `phone="+91 98765 00003"`, `email="guest.khandelwal@example.com"`
    - `upi_id="guest@examplebank"`
  - **Verification:** Seed file inspection and test suite confirmed zero external email domains or live telephone formats.

---

## 4. Git History Leakage Findings

The repository was examined through its entire commit progression:

```
* 533c23d (HEAD -> main) feat(auth): completely remove google oauth across frontend, backend, and environment templates
* 8efbcd4 docs(report): add comprehensive pre-publication transformation report
* 565c951 fix(brand): complete public transformation to TapMenu Open Hospitality Platform
* 69ed8a5 docs(audit): add comprehensive pre-publication audit report
* 6ddf573 feat(brand): complete full repository transformation to TapMenu Open Hospitality Platform
* e52e056 chore(init): initial commit of hotel management platform codebase
```

### Git Deep Inspection Results:
1. **Commit History Diff Scan:** Automated scanner processed the complete `git log -p` output (7,212,475 characters across all 6 commits). Zero private keys, zero active authorization tokens, and zero live credentials were discovered in deleted lines or past commits.
2. **Commit `533c23d` (Google OAuth Removal):** Verified that Google Client Secrets were not committed; all removal was cleanly executed across frontend and backend configurations.
3. **Commit `6ddf573` (Branding & Asset Replacement):** Verified that 26.5 MB of proprietary commercial hotel photos were permanently replaced with lightweight open assets.
4. **Git Objects & Blobs Integrity:** No untracked blobs containing database dumps (`*.sql`, `*.dump`) exist in the repository object store.

---

## 5. Malicious and Harmful Code Audit

The repository was analyzed for backdoors, unauthorized remote access, covert data exfiltration, cryptominers, and malicious package hooks.

| Audit Vector | Findings | Post-Remediation Status |
| :--- | :--- | :--- |
| **Backdoors & Covert Access** | **NONE** | Authentication routes adhere to standard bcrypt verification; no hidden bypass flags found. |
| **Outbound Telemetry / Beacons** | **NONE** | No covert network requests. External requests are limited to configured payment/notification providers. |
| **Insecure Dynamic Execution** | **NONE** | No `eval()`, `exec()`, or dynamic code compilation in backend or frontend code. |
| **Dangerous Subprocess Calls** | **NONE** | Backend uses pure Python async libraries; no raw shell subprocess invocations. |
| **Package Manifest Hooks** | **CLEAN** | `package.json` across workspaces contains no suspicious `preinstall`, `postinstall`, or lifecycle scripts. |
| **Automation Shell Scripts** | **RESOLVED** | `scripts/backup-db.sh` & `restore-db.sh` normalized to LF line endings, syntax verified with `bash -n`, and sanitized to generic `open_hospitality_db` and `tapmenu_db_` naming. |

---

## 6. Application Security Checks (OWASP Top 10)

### 6.1. A01: Broken Access Control & Multi-Tenancy
- **Tenant Isolation:** Database models consistently enforce `property_id` and `organization_id` partitioning across room types, folios, KDS tickets, and guest reservations.
- **RBAC Enforcement:** Role-based access control is enforced via `RoleChecker` dependencies verifying user scopes (`superadmin`, `general_manager`, `front_desk`, `cashier`, `housekeeping`, `kitchen`).
- **Staff vs Guest Separation:** Staff portal authentication (`/api/v1/auth/login`) is physically and logically separated from customer/guest portal authentication (`/auth/login` via Fastify gateway).

### 6.2. A02: Cryptographic Failures & Password Storage
- **Password Hashing:** Passwords are consistently hashed using `bcrypt` (12 rounds) with modern salt generation. Plaintext passwords are never logged or stored.
- **JWT Signing:** JWT tokens use `HS256` with token expiration (`ACCESS_TOKEN_EXPIRE_MINUTES = 480`). Fallback secret is strictly blocked outside local development.

### 6.3. A03: Injection Defenses (SQLi & XSS)
- **SQL Injection:** Python backend uses SQLAlchemy 2.0 async ORM with parameterized queries. Website backend uses parameterized `pg` queries. Zero string concatenation in SQL queries.
- **Cross-Site Scripting (XSS):** React 19 JSX auto-escapes all rendered text. No instances of `dangerouslySetInnerHTML` found in user-facing inputs.
- **HTTP Security Headers:** Implemented in `backend/app/main.py:60-100`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy: default-src 'self'; frame-ancestors 'none';`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforced when `APP_ENV=production`)

### 6.4. A05: Security Misconfiguration & Information Disclosure
- **SEC-04: Unhandled Error String in `/health/ready` — `RESOLVED`**
  - **Previous State:** `content={"status": "unhealthy", "database": "disconnected", "error": str(e)}` reflected internal driver exceptions.
  - **Remediation:** Replaced with generic error code and server-side warning log:
    ```python
    except Exception as e:
        logging.getLogger("backend.health").warning("Database readiness probe failed: %s", e)
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected", "error": "database_unavailable"}
        )
    ```
  - **Verification:** Unit test simulating connection failure confirmed HTTP 503 response with `error: database_unavailable` and zero credential leakage.

- **SEC-05: Container Runs as Root — `RESOLVED`**
  - **Previous State:** `backend/Dockerfile` had no `USER` directive.
  - **Remediation:** Configured dedicated unprivileged user `appuser` (UID 10001, GID 10001) with recursive `/app` ownership.

---

## 7. `.gitignore` & Repository Cleanliness Assessment

The root and nested `.gitignore` files were inspected to verify protection against future accidental credential commits:

- **Ignored Patterns Confirmed:**
  - Environment files: `.env`, `*.env`, `.env.production`, `.env.local`
  - Key & Secret files: `*.pem`, `*.key`, `*.pfx`, `*.p12`
  - Database & Log files: `*.sqlite`, `*.db`, `*.log`, `backups/`
  - Operational dumps: `production-users*.json`, `booking_backup_*.json`
  - Build Artifacts: `node_modules/`, `dist/`, `dist-ssr/`, `.vite/`, `__pycache__/`
- **Tracked Environment Files:** Only safe, sanitized templates (`.env.example` and `.env.production.example`) are tracked in the repository.

---

## 8. Risk Classification Table

| ID | Finding Title | Severity | Impact | Likelihood | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Default Fallback JWT `SECRET_KEY` in `config.py` | **MEDIUM** | HIGH | LOW | **RESOLVED & VERIFIED** |
| **SEC-02** | Default Superadmin Account in `demo_seed.py` | **LOW** | MEDIUM | LOW | **RESOLVED & VERIFIED** |
| **SEC-03** | Realistic Contact Numbers & PII in `demo_seed.py` | **LOW** | LOW | MEDIUM | **RESOLVED & VERIFIED** |
| **SEC-04** | Raw Exception String Reflected in `/health/ready` | **LOW** | LOW | MEDIUM | **RESOLVED & VERIFIED** |
| **SEC-05** | Dockerfile Executes Service as Root User | **INFO** | LOW | LOW | **RESOLVED & VERIFIED** |
| **SEC-06** | Residual `dreamheavens` Fallback in Backup Scripts | **INFO** | LOW | LOW | **RESOLVED & VERIFIED** |

---

## 9. Executed Remediation & Verification Record

All five remediation items were implemented surgically without breaking existing interfaces:

### Modification 1: Demo Seed Data Sanitization & Guard
- **File:** `backend/app/seed/demo_seed.py`
- **Changes:**
  - Added production guard `if settings.APP_ENV == "production": raise RuntimeError(...)`.
  - Replaced guest phone numbers with fictional `+91 98765 00001`, `+91 98765 00002`, `+91 98765 00003`.
  - Replaced guest emails with RFC 2606 reserved domains (`guest.sharma@example.com`, etc.).
  - Replaced payment UPI VPA with non-functional placeholder `guest@examplebank`.

### Modification 2: Information Disclosure Guard in Health Check
- **File:** `backend/app/main.py`
- **Changes:**
  - Catch block now logs detailed diagnostics internally via `backend.health` logger.
  - JSONResponse returns generic `error: "database_unavailable"` with HTTP 503 status code.

### Modification 3: Strict Multi-Environment JWT Secret Validation
- **File:** `backend/app/core/config.py`
- **Changes:**
  - `validate_secret_key` restricts default keys to `("development", "test")`.
  - Enforces minimum 32 characters and rejects known insecure tokens in all other environments.
  - Fails safely without printing secret values in errors.

### Modification 4: Backup & Restore Script Defaults
- **Files:** `scripts/backup-db.sh`, `scripts/restore-db.sh`
- **Changes:**
  - Default database name updated to `open_hospitality_db`.
  - Default user updated to `open_admin`.
  - Default backup prefix changed from `dh_db_` to `tapmenu_db_`.
  - Retention purge command supports both `tapmenu_db_*.sql.gz*` and legacy `dh_db_*.sql.gz*`.
  - Normalized line endings to LF; syntax verified with `bash -n`.

### Modification 5: Non-Root Docker Container Hardening
- **File:** `backend/Dockerfile`
- **Changes:**
  - Created unprivileged group `appgroup` (GID 10001) and user `appuser` (UID 10001).
  - Applied `--chown=appuser:appgroup` during file copying and `chown -R` on `/app`.
  - Added `USER appuser` directive before CMD.

---

## 10. Regression Testing Evidence

The following verification test suites were executed with 100% success:

1. **JWT Secret Validator Test Matrix (6 Scenarios):**
   - Scenario 1 (Development default key): `PASS`
   - Scenario 2 (Test environment default key): `PASS`
   - Scenario 3 (Production with default key): `PASS (ValidationError raised)`
   - Scenario 4 (Production with weak key): `PASS (ValidationError raised)`
   - Scenario 5 (Staging with default key): `PASS (ValidationError raised)`
   - Scenario 6 (Production with valid 64-char key): `PASS`
2. **Readiness Probe Failure Simulation:**
   - Simulated PostgreSQL connection refusal with mock credentials.
   - Status: HTTP 503.
   - Content: `{"status": "unhealthy", "database": "disconnected", "error": "database_unavailable"}`.
   - Zero credential or host string leakage confirmed.
3. **Demo Seed Production Guard Simulation:**
   - Tested `seed_demo_data()` with `APP_ENV="production"`.
   - Result: `RuntimeError: Demo seed execution is strictly prohibited in production environment.`
4. **Backend Python Test Suite:**
   - 49 unit and integration tests passed across `test_auth.py`, `test_reservations.py`, `test_fnb.py`, `test_folios_and_payments.py`, `test_guests.py`, `test_qr_room_security.py`, and `test_e2e_guest_lifecycle.py`.
5. **Website Backend (Fastify) Test Suite:**
   - 74 tests executed: 68 passed, 0 failed, 6 skipped (Postgres-dependent).
   - TypeScript compilation (`tsc --noEmit`): 0 errors.
6. **Frontend Website Test Suite & Typecheck:**
   - 144 unit and component tests passed across 14 test files.
   - TypeScript compilation (`tsc -b`): 0 errors.
7. **Frontend HMS Staff Portal Build:**
   - Complete production build succeeded (`tsc -b && vite build`) in 7.66s.
8. **Shell Script Syntax Verification:**
   - `bash -n scripts/backup-db.sh`: Clean (Exit 0).
   - `bash -n scripts/restore-db.sh`: Clean (Exit 0).

---

## 11. Final GitHub Publication Readiness Verdict

### **VERDICT: SAFE TO PUSH**

The repository has been thoroughly sanitized, hardened, and verified. 
- All sensitive information and PII have been removed.
- Container execution is locked down to a non-root user.
- Default secrets are strictly forbidden outside local development.
- Error responses do not leak infrastructure internals.
- All frontend and backend builds and test suites pass cleanly.

The repository is fully ready for publication to GitHub under the **TapMenu — Open Hospitality Platform** identity.
