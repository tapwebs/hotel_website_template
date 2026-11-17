<div align="center">
  <img src="docs/favicon.png" width="110" height="110" alt="TAPWEBS TapMenu Logo" />
  <h1>TapMenu — Open Hospitality Platform</h1>
  <p><strong>An Integrated Digital Ecosystem for Modern Hotel Operations &amp; Guest Experiences</strong></p>
  <p><em>Developed and maintained by <a href="https://tapwebs.in">TAPWEBS</a></em></p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-0D9488?style=for-the-badge" alt="MIT License" /></a>
    <img src="https://img.shields.io/badge/Architecture-Modular%20Monolith-7C3AED?style=for-the-badge" alt="Modular Monolith" />
    <img src="https://img.shields.io/badge/Status-Production--Ready-2563EB?style=for-the-badge" alt="Production Ready" />
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/Fastify-5.2+-000000?style=flat-square&logo=fastify&logoColor=white" alt="Fastify" />
    <img src="https://img.shields.io/badge/Node.js-24+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 24+" />
    <img src="https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python 3.12+" />
    <img src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  </p>
</div>

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Platform Capabilities](#2-platform-capabilities)
- [3. Visual Showcase](#3-visual-showcase)
- [4. System Architecture](#4-system-architecture)
- [5. Core Modules](#5-core-modules)
- [6. Technology Stack](#6-technology-stack)
- [7. Security & Engineering Standards](#7-security--engineering-standards)
- [8. Project Structure](#8-project-structure)
- [9. Getting Started](#9-getting-started)
- [10. Environment Configuration](#10-environment-configuration)
- [11. Development & Testing](#11-development--testing)
- [12. Deployment](#12-deployment)
- [13. Documentation & Specifications](#13-documentation--specifications)
- [14. Project Philosophy](#14-project-philosophy)
- [15. Authors & Maintainers](#15-authors--maintainers)
- [16. License & Ownership](#16-license--ownership)

---

## 1. Overview

**TapMenu Open Hospitality Platform** is an enterprise-grade, privacy-first, independently deployable hotel management and guest experience ecosystem. Designed from the ground up to replace fragmented legacy hospitality software, TapMenu combines direct guest acquisition with operational back-office automation into a cohesive, synchronized architecture.

The platform unifies:
1. **Guest-Facing Channels:** A high-performance marketing website, interactive 3D spatial hotel tour, instant room availability engine, and self-service in-room dining via dynamic QR codes.
2. **Operational Core:** A centralized Hotel Management System (HMS) managing front-desk check-ins, reservations, room inventories, housekeeping tasks, and guest profiles.
3. **Dining & Culinary Operations:** An integrated Point of Sale (POS) and real-time Kitchen Display System (KDS) managing order lifecycle from table/room placement through delivery.
4. **Financial Engineering:** Comprehensive folios, deposit tracking, multi-payment reconciliation, GST-compliant tax invoicing, and nightly audit closing routines.

Rather than stitching disparate third-party tools together with brittle webhooks, TapMenu unifies staff workflows and guest touchpoints across hardened, authenticated REST APIs backed by ACID-compliant PostgreSQL persistence.

---

## 2. Platform Capabilities

| Capability | Scope & Functionality | Target Users |
|---|---|---|
| **Public Hotel Website** | Luxury property showcase, dynamic room rates, rich amenity tours, and SEO pre-rendering | Prospective Guests & Travelers |
| **Direct Booking Engine** | Instant availability search, rate plan selection, reservation holds, and direct confirmation | Guests & Travel Bookers |
| **Hotel Management System** | Front-desk management, check-in/out workflows, interactive room rack, and guest registry | Front Desk, Duty Managers, Admins |
| **Point of Sale (POS)** | Table & room order entry, billing splits, discount controls, and immediate kitchen dispatch | Restaurant Captains, Cashiers |
| **Kitchen Display System (KDS)** | Real-time kitchen tickets, order pacing, ticket timers, and fulfillment controls | Executive Chefs, Line Cooks |
| **QR In-Room Dining** | Guest self-ordering, dietary filtering, real-time ticket tracking, and folio posting | In-House Hotel Guests |
| **Financial Ledger & Folios** | Transaction recording, incidentals routing, payment reconciliation, and ledger closing | Night Auditors, Accountants |
| **GST Tax Invoicing** | Automated CGST/SGST/IGST breakdown, financial-year sequencing, and tax reporting | Accounts & Compliance Staff |
| **Housekeeping & Maintenance** | Live room status dirty/clean/inspected, maintenance work orders, and maid assignment | Housekeeping Supervisors, Engineering |
| **Analytics & Reporting** | RevPAR, ADR, occupancy percentages, daily revenue summaries, and F&B sales metrics | General Managers, Hotel Owners |

---

## 3. Visual Showcase

<div align="center">
<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/home.png" alt="Public Hotel Website" style="max-width:100%; border-radius:6px;" />
      <br />
      <strong>Public Hotel Website &amp; Booking Experience</strong>
      <br />
      <em>High-conversion guest portal featuring property presentation, amenities, and direct booking.</em>
    </td>
    <td width="50%" align="center">
      <img src="docs/room.png" alt="Room Discovery & Booking" style="max-width:100%; border-radius:6px;" />
      <br />
      <strong>Room Discovery &amp; Real-Time Inventory</strong>
      <br />
      <em>Granular room category showcase with pricing, availability, and instant reservation holds.</em>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/dining.png" alt="Guest Dining Interface" style="max-width:100%; border-radius:6px;" />
      <br />
      <strong>Guest Dining &amp; QR Ordering Interface</strong>
      <br />
      <em>In-room dining &amp; restaurant digital menu with seamless ordering to POS and kitchen display.</em>
    </td>
    <td width="50%" align="center">
      <img src="docs/3dhotelview.png" alt="3D Hotel Visualization" style="max-width:100%; border-radius:6px;" />
      <br />
      <strong>Interactive 3D Architectural Experience</strong>
      <br />
      <em>Spatial Three.js architectural visualizer providing prospective guests an immersive hotel tour.</em>
    </td>
  </tr>
</table>
</div>

---

## 4. System Architecture

TapMenu adopts a **modular monolith** topology with distinct frontend and backend boundaries. Applications communicate across hardened internal contracts, decoupling customer-facing marketing traffic from core operational workloads while maintaining unified data integrity.

```mermaid
flowchart TD
    subgraph GuestLayer["Guest Experience Layer (Client-Side)"]
        WEB["Public Hotel Website<br/>(React 19 + Vite + Tailwind v4)<br/>Port: 5173"]
        DINE["QR In-Room Dining<br/>(React 19 + Tailwind v4)<br/>Port: 5174/dine/:token"]
        THREE["3D Spatial Experience<br/>(Three.js / WebGL)"]
    end

    subgraph StaffLayer["Staff Operations Layer"]
        CONSOLE["Hotel Staff Console<br/>(React 19 + TypeScript + Zustand)<br/>Port: 5174/app"]
        POS["Point of Sale (POS)<br/>(Register & Dining Orders)"]
        KDS["Kitchen Display (KDS)<br/>(Live Order Tickets)"]
    end

    subgraph GatewayLayer["API & Application Gateway"]
        SITE_API["Website API<br/>(Node.js 24 + Fastify 5)<br/>Port: 3001"]
        HMS_API["HMS Core API<br/>(Python 3.12 + FastAPI 0.110+)<br/>Port: 8001"]
    end

    subgraph PersistenceLayer["Data & Persistence Layer"]
        PG[("Primary Database<br/>(PostgreSQL 16+)")]
        ALEMBIC["Schema Migrations<br/>(Alembic + Fastify Migrations)"]
    end

    WEB -->|"Direct Booking & Inquiries (HTTPS)"| SITE_API
    DINE -->|"QR Order Placement (Session Token)"| HMS_API
    SITE_API -->|"SQL Pool (pg)"| PG
    HMS_API -->|"Async ORM (SQLAlchemy 2.0)"| PG
    ALEMBIC -.->|"DDL Evolution"| PG

    CONSOLE -->|"REST / JWT Auth"| HMS_API
    POS -->|"Order Dispatch"| HMS_API
    KDS -->|"Live Ticket Polling"| HMS_API

    SITE_API <-->|"HMAC Authenticated Sync"| HMS_API

    classDef guest fill:#1E293B,stroke:#38BDF8,stroke-width:1.5px,color:#F8FAFC;
    classDef staff fill:#3B0764,stroke:#C084FC,stroke-width:1.5px,color:#FAF5FF;
    classDef api fill:#064E3B,stroke:#34D399,stroke-width:1.5px,color:#ECFDF5;
    classDef data fill:#78350F,stroke:#FBBF24,stroke-width:1.5px,color:#FFFBEB;

    class WEB,DINE,THREE guest;
    class CONSOLE,POS,KDS staff;
    class SITE_API,HMS_API api;
    class PG,ALEMBIC data;
```

### Application Topology & Network Surface

| Subsystem | Stack | Default Port | Production Route | Description |
|---|---|---|---|---|
| **Public Website** | React 19, Vite, Tailwind v4 | `5173` | `https://example.com` | Guest marketing, room catalog & direct booking |
| **Website API** | Fastify 5, TypeScript | `3001` | `https://api.example.com/site` | Booking dispatch, QR Hub routing, inquiry handling |
| **Staff Console (HMS)** | React 19, Vite, Zustand | `5174` | `https://hms.example.com/app` | Operations, front desk, POS register, and KDS |
| **Guest In-Room Dining**| React 19, Vite | `5174` | `https://hms.example.com/dine/:token` | QR-based tokenized guest menu & order dispatch |
| **HMS Core API** | Python 3.12, FastAPI | `8001` | `https://api.example.com/api/v1` | Multi-tenant core, folios, inventory, and auth |
| **PostgreSQL Database** | PostgreSQL 16+ | `5432` | Internal Private Network | Relational storage for reservations, ledger, and users |

---

## 5. Core Modules

### 1. Public Hotel Website & Booking Portal
- **High-Performance Presentation:** Server-side static pre-rendering for major marketing pages, ensuring exceptional SEO indexing and sub-second load times.
- **Interactive 3D Experience:** Three.js architectural rendering with custom shaders, lighting, and camera positions allowing guests to explore the property visually.
- **Direct Reservation Engine:** Date-picker availability checks, room type comparisons, amenity highlights, and automated booking confirmation emails.
- **QR Hub & Smart Link Resolution:** Built-in dynamic shortlink and QR redirect router mapping physical property touchpoints to contextual digital flows.

### 2. Centralized Hotel Management System (HMS)
- **Front-Desk Room Rack:** Visual calendar matrix showing real-time occupancy, upcoming arrivals, departures, and out-of-order maintenance flags.
- **Guest Registry:** Comprehensive profile management tracking historical stays, guest preferences, identification documents, and notes.
- **Inventory & Rate Management:** Dynamic pricing rules, seasonal rate plans, minimum-stay restrictions, and room allocation policies.
- **Housekeeping Management:** Real-time dirty/clean/inspected status board, automated turnover queues triggered on checkout, and maid assignment tracking.

### 3. Point of Sale (POS) & Restaurant Operations
- **Floor & Table Management:** Visual table maps, capacity indicators, active session counters, and bill settlement workflows.
- **Menu Management:** Nested category hierarchies, modifier options (spice levels, preparation styles), and price overrides.
- **Direct Folio Charging:** Seamless one-click posting of restaurant and room-service charges to the guest's active room folio with audit trails.

### 4. Kitchen Display System (KDS)
- **Live Ticket Queues:** Real-time order dispatch from both POS terminals and in-room QR dining apps with visual color-coded urgency timers.
- **Fulfillment States:** Multi-stage workflow tracking (`Pending` → `Preparing` → `Ready` → `Delivered`) ensuring synchronized operations between kitchen line and runners.
- **Station Routing:** Multi-printer and station-specific routing (e.g., Main Kitchen vs. Beverage Bar).

### 5. In-Room QR Dining (TapMenu Dining)
- **Zero-Friction Access:** Guests scan an encrypted, room-specific QR code without requiring native mobile application downloads or account creation.
- **Session-Bound Cart:** Secure session token validation ensuring orders originate strictly from authorized active rooms.
- **Real-Time Order Tracking:** Live progress indicators informing guests when their meal is preparing and on its way.

### 6. Billing, Folios & Night Audit
- **Split & Master Folios:** Flexible billing structures supporting multiple folios per room, split billing for corporate guests, and incidentals routing.
- **GST Compliance:** Automated tax breakdowns (CGST, SGST, IGST) conforming with Indian hospitality taxation and sequential FY invoice numbering.
- **Night Audit Engine:** Automated end-of-day procedures verifying room charge postings, closing open registers, reconciling payment ledgers, and rolling the operational business date.

---

## 6. Technology Stack

### Frontend Architecture
- **Framework:** [React 19](https://react.dev/) with modern hooks and concurrent mode.
- **Build Tool:** [Vite](https://vitejs.dev/) with optimized Rollup code splitting and pre-rendering plugins.
- **Language:** [TypeScript 5.x](https://www.typescriptlang.org/) configured with strict type-safety.
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) with custom design tokens, luxury typography, and dark-mode support.
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) for predictable, boilerplate-free state.
- **3D Visualization:** [Three.js](https://threejs.org/) and `@react-three/fiber` for real-time WebGL rendering.
- **Icons & Motion:** [Lucide React](https://lucide.dev/) and [Framer Motion](https://www.framer.com/motion/).

### Backend Architecture
- **HMS Core Engine:** [Python 3.12+](https://www.python.org/) with [FastAPI](https://fastapi.tiangolo.com/) for high-throughput asynchronous execution.
- **Website API Engine:** [Node.js 24+](https://nodejs.org/) with [Fastify 5.x](https://fastify.dev/) for low-latency JSON handling.
- **Data Access:** [SQLAlchemy 2.0 (AsyncIO)](https://www.sqlalchemy.org/) with `asyncpg` driver for Python; native connection pooling via `pg` for Node.js.
- **Validation:** [Pydantic v2](https://docs.pydantic.dev/) (FastAPI) and [Zod](https://zod.dev/) (Fastify) for compile-time and runtime boundary validation.
- **Database Evolution:** [Alembic](https://alembic.sqlalchemy.org/) for Python data models; structured SQL migrations for Fastify.

### Persistence & Storage
- **Primary Database:** [PostgreSQL 16+](https://www.postgresql.org/) utilizing relational constraints, foreign keys, and indexes.
- **Development Fallback:** SQLite with `aiosqlite` for zero-configuration local testing and CI runners.

### Testing & Verification
- **Python Suites:** [Pytest](https://pytest.org/) with `pytest-asyncio` covering unit, integration, and security test suites.
- **Frontend Suites:** [Vitest](https://vitest.dev/) with React Testing Library.
- **API Verification:** Node.js native test runner (`node --test`).
- **Performance & Load:** [k6](https://k6.io/) and [Locust](https://locust.io/) suites for latency and concurrency profiling.

---

## 7. Security & Engineering Standards

The codebase has undergone comprehensive DevSecOps and Application Security audits to ensure production safety and privacy compliance.

### Hardened Security Controls
- **JWT Secret Enforcement:** Strict rejection of default, weak, or development JWT secrets in production and staging environments (`backend/app/core/config.py`).
- **Information Disclosure Prevention:** Health check endpoints (`/health/ready`) return generic error codes (`database_unavailable`) rather than reflecting raw database connection strings or stack traces.
- **Non-Root Container Isolation:** Backend Docker images execute under unprivileged user and group accounts (`appuser:appgroup`, UID 10001) to eliminate container breakout risks.
- **Role-Based Access Control (RBAC):** Default-deny authorization policies enforcing explicit permission checks across all administrative and staff endpoints.
- **Safe Demo Seeding:** Demo seed scripts (`backend/app/seed/demo_seed.py`) use fictionalized contact information and RFC 2606 reserved domains (`@example.com`), protected by a strict production startup guard.
- **SQL Injection Immunization:** All database operations utilize parameterized queries through SQLAlchemy ORM or parameterized SQL statements.
- **Rate Limiting & Abuse Defense:** IP-based and credential-based rate limiting on sensitive routes (authentication, booking requests, dining sessions).
- **Transport Security & Headers:** Pre-configured HTTP security headers including Content Security Policy (CSP), Strict-Transport-Security (HSTS), X-Frame-Options, and X-Content-Type-Options.

---

## 8. Project Structure

```text
HOTEL_DREAM_HEAVENS_PROJECT/
├── backend/
│   ├── alembic/                 # HMS database migrations and version history
│   ├── app/
│   │   ├── api/routes/          # FastAPI routers (auth, rooms, bookings, folios, POS)
│   │   ├── core/                # App config, database session, security, exceptions
│   │   ├── models/              # SQLAlchemy 2.0 ORM database entities
│   │   ├── schemas/             # Pydantic input/output validation models
│   │   ├── seed/                # Demo data generator and production bootstrap
│   │   └── services/            # Core business logic (billing, night audit, reservations)
│   ├── tests/                   # Pytest test suite (unit, integration, security)
│   ├── website/
│   │   ├── migrations/          # Fastify website SQL migration files
│   │   ├── src/                 # Fastify source code (routes, domain, auth, core)
│   │   ├── package.json         # Node.js backend dependencies
│   │   └── .env.example         # Website API environment template
│   ├── requirements.txt         # Python dependencies
│   └── .env.example             # HMS API environment template
├── docs/
│   ├── DEPLOYMENT_GUIDE.md      # Step-by-step production rollout guide
│   ├── WEBSITE.md               # Technical notes for public website
│   ├── specs/                   # 20 architectural & functional specifications
│   └── favicon.png              # Official TAPWEBS brand asset
├── frontend/
│   ├── hms/                     # Staff Console, POS, KDS & QR Dining
│   │   ├── src/
│   │   │   ├── components/      # UI components (buttons, dialogs, tables)
│   │   │   ├── pages/guest/     # QR In-Room Dining customer screens
│   │   │   ├── pages/staff/     # Staff operations (front desk, folios, KDS, POS)
│   │   │   └── stores/          # Zustand client state stores
│   │   └── package.json
│   └── website/                 # Guest Marketing Portal & Direct Booking
│       ├── src/
│       │   ├── components/      # Marketing UI components and booking bar
│       │   ├── data/            # Localized hotel profiles, room tiers, FAQs
│       │   ├── routes/          # Route views (Home, Rooms, Dining, Weddings)
│       │   └── seo/             # Structured JSON-LD schema & meta handlers
│       └── package.json
├── scripts/
│   ├── backup-db.sh             # Encrypted, checksummed PostgreSQL backup script
│   ├── restore-db.sh            # Checksum-verified database restoration utility
│   ├── check.sh                 # Unified lint, build, and test validation
│   ├── dev.sh                   # Multi-service development launcher
│   ├── load-test-k6.js          # k6 load testing scenario
│   └── locustfile.py            # Locust user journey load simulation
├── docker-compose.prod.yml       # Production container orchestration
├── SECURITY.md                  # Security policies and audit checklist
├── package.json                 # Monorepo root npm workspace manifest
└── README.md                    # Primary repository documentation
```

---

## 9. Getting Started

### Prerequisites

Ensure the following tools are installed in your development environment:
- **Node.js:** `v24.x` (LTS recommended)
- **Python:** `3.12+`
- **PostgreSQL:** `16+` (or use local SQLite mode for rapid prototyping)
- **npm:** `v10+`
- **Git:** Latest release

### Step 1: Clone the Repository

```bash
git clone https://github.com/tapwebs/hotel_website_template.git
cd hotel_website_template
```

### Step 2: Install Node.js Dependencies

Install all dependencies across root and nested npm workspaces:

```bash
npm install
```

### Step 3: Configure Python Virtual Environment

```bash
python3 -m venv backend/.venv

# Linux/macOS:
source backend/.venv/bin/activate

# Windows PowerShell:
.\backend\.venv\Scripts\Activate.ps1

pip install -r backend/requirements.txt
```

### Step 4: Initialize Environment Files

Create local configuration files from safe templates:

```bash
# HMS Core API
cp backend/.env.example backend/.env

# Website API
cp backend/website/.env.example backend/website/.env
```

### Step 5: Execute Database Migrations

Apply database schemas for the Website API and HMS Core:

```bash
# Website API Migrations
cd backend/website
npm run migrate
cd ../..

# HMS Core Migrations
alembic -c backend/alembic.ini upgrade head
```

### Step 6: Launch Development Services

Run all frontend and backend services concurrently:

```bash
npm run dev:all
```

Alternatively, use the orchestration shell script:

```bash
bash scripts/dev.sh
```

---

## 10. Environment Configuration

### HMS Core API (`backend/.env`)

| Variable | Default Value | Description |
|---|---|---|
| `APP_ENV` | `development` | Environment mode (`development`, `test`, `production`) |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/open_hospitality_db` | Asynchronous database connection string |
| `SECRET_KEY` | *(Random 64-char hex)* | JWT signing key (default rejected in production) |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Staff session token duration (8 hours) |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:5174"]` | Authorized frontend origins |
| `ENABLE_DEMO_SEED` | `false` | Allows seed script execution in local dev |

### Website API (`backend/website/.env`)

| Variable | Default Value | Description |
|---|---|---|
| `NODE_ENV` | `development` | Node runtime environment |
| `PORT` | `3001` | Fastify HTTP listening port |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/open_hospitality_db` | Relational connection pool URL |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origin for booking requests |

> [!IMPORTANT]
> Never commit production `.env` files or hardcoded credentials to version control. Always configure production secrets via deployment platforms (Coolify, Docker secrets, or cloud key vaults).

---

## 11. Development & Testing

TapMenu provides comprehensive verification scripts to validate linting, type definitions, unit tests, and production builds across all packages.

### Run All Checks

```bash
npm run check:all
```

Or execute the verification script directly:

```bash
bash scripts/check.sh
```

### Targeted Test Suites

```bash
# 1. Run Python HMS Core Tests (Pytest)
pytest backend/tests

# 2. Run Public Website Tests (Vitest)
npm run test:website

# 3. Run Website API Tests (Node.js test runner)
npm run test:website-api

# 4. Validate TypeScript Across All Workspaces
npm run typecheck --workspaces
```

### Performance & Concurrency Profiling

Evaluate endpoint latency under synthetic load:

```bash
# Execute k6 load scenario
k6 run scripts/load-test-k6.js

# Execute Locust interactive simulation
locust -f scripts/locustfile.py --host http://127.0.0.1:8001
```

---

## 12. Deployment

TapMenu is engineered for flexible deployment across modern VPS instances, container clusters, or dedicated cloud infrastructure.

### Production Docker Deployment

A battle-tested Docker Compose file is provided for multi-container deployments:

```bash
# Launch full stack with isolated networking
docker compose -f docker-compose.prod.yml up -d --build
```

### Production Checklist
1. **Secrets:** Generate cryptographically secure `SECRET_KEY` values via `openssl rand -hex 32`.
2. **Reverse Proxy:** Configure Nginx, Caddy, or Traefik with automatic TLS (Let's Encrypt), HTTP/2, and gzip/brotli compression.
3. **Database Maintenance:** Set up automated cron executions for `scripts/backup-db.sh` targeting offsite S3-compatible storage.
4. **Environment Isolation:** Verify `APP_ENV=production` and `ENABLE_DEMO_SEED=false` in container environments.

For a comprehensive walkthrough of Coolify, VPS setup, and Nginx configurations, consult [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md).

---

## 13. Documentation & Specifications

The repository includes detailed architectural and operational specifications in [`docs/specs/`](docs/specs/):

- [`00-PROJECT-CONTEXT-AND-GLOSSARY.md`](docs/specs/00-PROJECT-CONTEXT-AND-GLOSSARY.md) — Platform context and domain glossary.
- [`01-OVERVIEW.md`](docs/specs/01-OVERVIEW.md) — High-level functional architecture.
- [`01-PRODUCT-REQUIREMENTS-AND-SCOPE.md`](docs/specs/01-PRODUCT-REQUIREMENTS-AND-SCOPE.md) — Product requirements and project boundaries.
- [`02-SYSTEM-ARCHITECTURE-AND-TECH-STACK.md`](docs/specs/02-SYSTEM-ARCHITECTURE-AND-TECH-STACK.md) — Technical stack and architecture decisions.
- [`02-TOOLS-AND-INTEGRATIONS.md`](docs/specs/02-TOOLS-AND-INTEGRATIONS.md) — External tool integrations and services.
- [`03-HOW-THE-WEBSITE-WILL-FUNCTION.md`](docs/specs/03-HOW-THE-WEBSITE-WILL-FUNCTION.md) — Guest website user journeys and workflows.
- [`03-USERS-RBAC-SECURITY-AND-AUDIT.md`](docs/specs/03-USERS-RBAC-SECURITY-AND-AUDIT.md) — User roles, permissions, and security matrix.
- [`04-PROPERTY-ROOMS-RATES-AND-AVAILABILITY.md`](docs/specs/04-PROPERTY-ROOMS-RATES-AND-AVAILABILITY.md) — Inventory and dynamic rate engine.
- [`04-WEBSITE-FEATURES.md`](docs/specs/04-WEBSITE-FEATURES.md) — Detailed website functionality specifications.
- [`05-RESERVATIONS-FRONT-DESK-AND-GUESTS.md`](docs/specs/05-RESERVATIONS-FRONT-DESK-AND-GUESTS.md) — Front-desk booking and stay lifecycle.
- [`06-HOUSEKEEPING-MAINTENANCE-AND-OPERATIONS.md`](docs/specs/06-HOUSEKEEPING-MAINTENANCE-AND-OPERATIONS.md) — Room turnover and maintenance orders.
- [`07-FNB-POS-KDS-ROOM-SERVICE.md`](docs/specs/07-FNB-POS-KDS-ROOM-SERVICE.md) — Dining POS, kitchen display, and QR ordering.
- [`08-FOLIO-BILLING-PAYMENTS-AND-NIGHT-AUDIT.md`](docs/specs/08-FOLIO-BILLING-PAYMENTS-AND-NIGHT-AUDIT.md) — Folio ledger, invoicing, and night audit.
- [`09-CHANNELS-WEBSITE-AND-INTEGRATIONS.md`](docs/specs/09-CHANNELS-WEBSITE-AND-INTEGRATIONS.md) — Channel connectivity and distribution.
- [`10-DASHBOARD-REPORTING-MULTI-PROPERTY-NOTIFICATIONS.md`](docs/specs/10-DASHBOARD-REPORTING-MULTI-PROPERTY-NOTIFICATIONS.md) — Executive reporting and alerting.
- [`11-DATABASE-DATA-MODEL.md`](docs/specs/11-DATABASE-DATA-MODEL.md) — Complete relational schema and entity relationships.
- [`12-API-BACKGROUND-JOBS-AND-INTEGRATION-CONTRACTS.md`](docs/specs/12-API-BACKGROUND-JOBS-AND-INTEGRATION-CONTRACTS.md) — API payloads and job contracts.
- [`13-FRONTEND-UI-UX-AND-SCREEN-SPECIFICATION.md`](docs/specs/13-FRONTEND-UI-UX-AND-SCREEN-SPECIFICATION.md) — UI design tokens, wireframes, and UX guidelines.
- [`14-QA-DEVOPS-ROADMAP-AND-TRACEABILITY.md`](docs/specs/14-QA-DEVOPS-ROADMAP-AND-TRACEABILITY.md) — Quality assurance, CI pipelines, and deployment roadmap.
- [`15-HMS_SETTINGS_CONFIGURATION_SPECIFICATION.md`](docs/specs/15-HMS_SETTINGS_CONFIGURATION_SPECIFICATION.md) — Settings and configuration reference.

---

## 14. Project Philosophy

TapMenu Open Hospitality Platform is built around an uncompromising engineering standard:

> **"One connected platform. One operational ecosystem. A consistent guest experience."**

Hospitality technology has suffered for decades from disjointed point solutions — reservation software that fails to communicate with restaurant POS, kitchen tickets lost in manual communication, and guest data fragmented across siloed databases. 

TapMenu eliminates this friction through a unified data plane. When a guest books a room, orders dinner via in-room QR, requests extra towels, or settles their invoice, every interaction updates a single synchronized operational model.

---

## 15. Authors & Maintainers

**TapMenu Open Hospitality Platform is developed and maintained by [TAPWEBS](https://tapwebs.in).**

TAPWEBS builds robust, scalable web platforms, intelligent automation systems, and security-hardened open-source software solutions.

<div align="center">
  <br />
  <a href="https://tapwebs.in">
    <img src="docs/favicon.png" width="56" height="56" alt="TAPWEBS Logo" />
  </a>
  <br />
  <strong>TapMenu · Powered by TAPWEBS</strong>
  <br />
  <em>Integrated Hospitality. Smarter Operations. Better Experiences.</em>
  <br /><br />
  🌐 <a href="https://tapwebs.in">Website</a> &nbsp;|&nbsp; 📧 <a href="mailto:contact@tapwebs.in">Contact Us</a> &nbsp;|&nbsp; 💼 <a href="https://tapwebs.in">Enterprise Services</a>
</div>

---

## 16. License & Ownership

This project is open-source software licensed under the **[MIT License](LICENSE)**.

```text
MIT License

Copyright (c) 2026 TAPWEBS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
