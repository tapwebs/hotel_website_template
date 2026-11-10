# 🏨 TapMenu — Open Hospitality Platform

<p align="center">
  <strong>An Integrated Open-Source Digital Ecosystem for Modern Hotel Operations</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Hospitality%20Technology-2563EB?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/Architecture-Modular%20Monolith-7C3AED?style=for-the-badge" alt="Architecture">
  <img src="https://img.shields.io/badge/License-MIT-0D9488?style=for-the-badge" alt="License">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-Enabled-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
</p>

---

## Overview

**TapMenu Open Hospitality Platform** is an enterprise-grade, privacy-first open-source hotel management and guest experience platform.

The platform brings hotel operations, guest services, restaurant management and digital booking into one connected ecosystem.

It combines a public-facing hotel website, a centralized Hotel Management System (HMS), an integrated Point of Sale (POS), a Kitchen Display System (KDS), and an in-room QR-based dining experience.

Rather than operating through disconnected applications, the platform connects guest-facing services with internal hotel operations through authenticated APIs and synchronized business workflows.

### Platform Capabilities

| Module | Description |
|---|---|
| Public Website | Hotel marketing, property discovery and guest acquisition |
| Booking Engine | Direct guest reservations and booking management |
| Hotel Management System | Centralized hotel operations and front-desk management |
| Point of Sale | Restaurant ordering, billing and payment workflows |
| Kitchen Display System | Kitchen order visibility and ticket management |
| In-Room Dining | QR-enabled guest ordering experience |
| Guest Management | Guest profiles, accounts and reservation records |
| Financial Operations | Folios, payments, GST invoicing and night audit |
| Housekeeping | Room housekeeping and operational task management |
| Analytics & Reporting | Operational dashboards and financial reporting |

---

## Platform Architecture

TapMenu follows a **modular monolith architecture** with independently organized frontend and backend workspaces.

The ecosystem consists of four primary application components:

1. Public Guest Website
2. Website Backend API
3. TapMenu Hotel Management System
4. Staff Console and Guest Dining Interface

### High-Level Architecture

```text
                   GUEST EXPERIENCE LAYER
                             |
             +---------------+---------------+
             |                               |
      Public Hotel Website              QR Dining
       React 19 + Vite                 React 19 + Vite
             |                               |
             +---------------+---------------+
                             |
                       HTTPS / REST
                             |
                 +-----------+-----------+
                 |                       |
           WEBSITE API               HMS API
           Fastify                   FastAPI
           Port 3001                 Port 8001
                 |                       |
                 |   Authenticated       |
                 +---- HMAC / JWT -------+
                                         |
                                  PostgreSQL
                                         |
                              +----------+----------+
                              |          |          |
                             HMS        POS         KDS
                              |
                     HOTEL OPERATIONS
                              |
                  Reservations / Rooms
                  Guests / Master Folios
                  Billing / GST Invoices
                  Housekeeping / Reports
                  Night Audit / Payments
```

### Infrastructure

| Component | Infrastructure |
|---|---|
| Public Website | Hostinger Web Hosting |
| Backend Services | Hostinger VPS |
| Container Management | Coolify |
| HMS Backend | FastAPI |
| Website Backend | Fastify |
| Primary Database | PostgreSQL |
| Frontend Delivery | Vite Production Builds |
| Web Communication | REST APIs over HTTPS |
| Database Migrations | Alembic and Website API migrations |

### Application Endpoints (Default Local Ports / Configurable Domains)

| Application | Local Port | Production Example |
|---|---|---|
| Public Hotel Website | http://localhost:5173 | https://example.com |
| Staff Console (HMS) | http://localhost:5174 | https://hms.example.com |
| Website API (Fastify) | http://localhost:3001 | https://api.example.com/site |
| HMS Core API (FastAPI) | http://localhost:8001 | https://api.example.com/api/v1 |
| Guest Dining | http://localhost:5174/dine/:token | https://hms.example.com/dine/:token |

---

## Core Modules

### 1. Public Hotel Website

A customer-facing digital presence designed to help guests discover the property and make direct reservations.

**Capabilities:**
- Hotel information and property presentation.
- Room and accommodation discovery.
- Direct guest booking experience.
- Guest accounts and authentication.
- Search-engine optimization and structured data.
- Static pre-rendering for public marketing routes.
- QR Hub and shortlink infrastructure.
- Analytics integration with Google Analytics 4 and Search Console.

**Technology:** React 19, Vite, TypeScript and Three.js.

### 2. Hotel Management System (HMS)

The centralized operational application for hotel staff.

**Operational capabilities:**
- Hotel dashboard and operational reporting.
- Reservation management.
- Front-desk check-in and check-out.
- Room and inventory management.
- Rate plans and availability.
- Guest profile management.
- Master folios and financial transactions.
- GST-compliant invoice generation.
- Housekeeping operations.
- Maintenance task management.
- Night audit and financial reporting.

### 3. Point of Sale (POS)

Integrated restaurant and hotel-service ordering workflows.

**Capabilities:**
- POS register and menu management.
- Order processing and visibility.
- Payment transaction references.
- Folio-related financial workflows.
- Integration with kitchen operations.

### 4. Kitchen Display System (KDS)

A dedicated kitchen-facing interface for managing incoming restaurant orders.

**Capabilities:**
- Kitchen ticket visibility.
- Order management.
- Integration with POS workflows.
- Centralized order status visibility.

### 5. QR-Based In-Room Dining

A guest-facing web application activated through room-specific QR access.

**Capabilities:**
- QR-enabled guest dining access.
- Token-based dining interface.
- Restaurant menu and ordering experience.
- Integration with hotel POS and kitchen workflows.

---

## Technology Stack

The platform uses a modern web development stack with dedicated technologies for frontend applications, backend services, database management and deployment.

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript |
| Frontend Tooling | Vite |
| Website Backend | Node.js, Fastify |
| HMS Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM / Database Layer | SQLAlchemy |
| Database Migrations | Alembic |
| Authentication | JWT, secure session cookies |
| Password Security | Argon2 / scrypt |
| API Communication | REST, HTTPS |
| Web Protection | Cloudflare Turnstile |
| Deployment | Docker, Coolify |
| Infrastructure | Hostinger VPS |
| Testing | Pytest, Vitest, Node.js Test Runner |
| Load Testing | k6, Locust |
| SEO | Schema.org, JSON-LD, XML Sitemap |

---

## Repository Structure

```text
HOTEL_DREAM_HEAVENS_PROJECT/
│
├── backend/
│   │
│   ├── app/
│   │   ├── api/routes/        # HMS API endpoints
│   │   ├── core/              # Configuration, database and security
│   │   ├── models/            # Database models
│   │   ├── schemas/           # API validation schemas
│   │   ├── seed/              # Development and production setup
│   │   └── services/          # Business logic
│   │
│   ├── alembic/               # HMS database migrations
│   ├── tests/                 # Backend test suites
│   │
│   ├── website/
│   │   ├── src/core/          # Database and authentication
│   │   ├── src/domain/        # Business domain logic
│   │   ├── src/integrations/  # External integrations
│   │   └── src/routes/        # Website API routes
│   │
│   ├── requirements.txt
│   ├── .env.example
│   └── .env.production.example
│
├── frontend/
│   │
│   ├── hms/
│   │   └── src/
│   │       ├── pages/staff/   # Staff operational modules
│   │       ├── pages/guest/   # Guest dining interface
│   │       └── services/      # API client and data services
│   │
│   └── website/
│       └── src/
│           ├── components/    # Website UI components
│           ├── seo/           # SEO and structured data
│           └── public/        # Static public assets
│
├── docs/
│   ├── DEPLOYMENT_GUIDE.md
│   ├── WEBSITE.md
│   └── specs/
│
├── scripts/
│   ├── dev.sh
│   ├── check.sh
│   ├── backup-db.sh
│   ├── restore-db.sh
│   ├── load-test-k6.js
│   └── locustfile.py
│
├── docker-compose.prod.yml
├── SECURITY.md
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

Install the following development dependencies:

| Dependency | Version |
|---|---|
| Node.js | 24.22.0 |
| Python | 3.12+ |
| PostgreSQL | Required for database-backed development |
| npm | Included with Node.js |
| Git | Latest stable release |

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>

cd HOTEL_DREAM_HEAVENS_PROJECT
```

### 2. Install Node.js Dependencies

```bash
npm install
```

This installs dependencies across the configured npm workspaces:

- `frontend/hms`
- `frontend/website`
- `backend/website`

### 3. Configure Python Environment

```bash
python3 -m venv backend/.venv

source backend/.venv/bin/activate

pip install -r backend/requirements.txt
```

### 4. Configure Environment Variables

```bash
cp backend/.env.example backend/.env

cp backend/website/.env.example backend/website/.env
```

Configure the required database credentials, application secrets, API integration keys and other environment-specific settings.

Never commit production secrets or actual environment files.

### 5. Run Website Database Migrations

```bash
cd backend/website

npm run migrate

cd ../..
```

### 6. Start Development Services

Run all configured development services:

```bash
npm run dev:all
```

Alternatively:

```bash
bash scripts/dev.sh
```

### Local Development Endpoints

| Service | Local URL |
|---|---|
| Public Website | http://localhost:5173 |
| Staff Console | http://localhost:5174/app |
| In-Room Dining | http://localhost:5174/dine/:token |
| HMS API | http://127.0.0.1:8001 |
| HMS Swagger Documentation | http://127.0.0.1:8001/docs |
| Website API | http://127.0.0.1:3001 |

---

## Testing & Quality Assurance

The repository includes a unified verification workflow covering backend tests, frontend validation, API tests and production builds.

### Run Full Verification

```bash
npm run check:all
```

Or:

```bash
bash scripts/check.sh
```

### Verification Coverage

| Component | Verification |
|---|---|
| HMS Backend | Pytest |
| Authorization | RBAC and default-deny permission tests |
| Rate Limiting | IP and username-based protection |
| Financial Operations | Folio and night-audit verification |
| Guest Lifecycle | End-to-end booking and stay workflows |
| Staff Frontend | TypeScript validation and production build |
| Website Backend | TypeScript checks and Node.js tests |
| Public Website | Lint, Vitest and production build |
| SEO | Static pre-rendering and sitemap generation |

### Critical Business Workflow Testing

The backend test suite covers the documented end-to-end guest lifecycle:

```text
Availability Search
       |
       v
Reservation Hold
       |
       v
Booking Confirmation
       |
       v
Guest Check-In
       |
       v
Folio Charges
       |
       v
Payment Processing
       |
       v
Guest Check-Out
       |
       v
GST Invoice Generation
       |
       v
Housekeeping Task Creation
```

Additional verification includes:

- Role-based access control.
- Financial ledger calculations.
- Idempotent transaction handling.
- Night audit and prepaid stay handling.
- Database query efficiency.
- Guest and reservation workflows.

---

## Production Deployment

The production environment uses a Hostinger VPS with Coolify for backend service deployment and Hostinger web hosting for static frontend delivery.

### Infrastructure Components

| Service | Deployment |
|---|---|
| PostgreSQL | Coolify-managed database |
| HMS API | FastAPI container |
| Website API | Fastify container |
| Staff Console | Static production build |
| Public Website | Static pre-rendered production build |

### Backend Deployment

**HMS API**

```bash
pip install -r backend/requirements.txt

alembic upgrade head

uvicorn backend.app.main:app \
  --host 0.0.0.0 \
  --port 8001
```

Production configuration:

```env
APP_ENV=production
DEBUG=false
ENABLE_DEMO_SEED=false
TRUST_PROXY=true
POSTGRES_POOL_SIZE=20
POSTGRES_MAX_OVERFLOW=10
```

Configure all required secrets through Coolify environment variables.

**Website API**

```bash
cd backend/website

npm ci

npm run build

npm start
```

### Frontend Deployment

**Staff Console**

```bash
cd frontend/hms

npm ci

npm run build
```

Deploy the generated `dist/` directory to the HMS subdomain hosting directory.

**Public Website**

```bash
cd frontend/website

npm ci

npm run build
```

Deploy the contents of `frontend/website/dist/` into the Hostinger `public_html/` directory.

Ensure that the generated `.htaccess` file is included.

---

## Security Architecture

Security is integrated into the application architecture and backend authorization layer.

### Security Controls

| Area | Implementation |
|---|---|
| Authentication | JWT and secure session cookies |
| Authorization | Role-Based Access Control |
| Permissions | Default-deny authorization guards |
| Password Storage | Argon2 / scrypt |
| Rate Limiting | IP and username-based controls |
| API Communication | HTTPS |
| Service Integration | HMAC-authenticated integration |
| Database | Restricted application-level privileges |
| Web Protection | Turnstile CAPTCHA |
| Browser Security | CSP and additional security headers |
| Auditability | Operational and security logging |

### Indian Regulatory Considerations

The platform incorporates workflows and controls relevant to Indian hospitality operations.

**Digital Personal Data Protection (DPDP) Act, 2023**
- Guest consent workflows.
- Cookie consent management.
- Analytics opt-out controls.

**Foreign Guest Reporting**
- Check-in information capture for applicable Form C reporting requirements.

**GST Invoicing**
- GST calculations based on configured accommodation and service tax rules.
- CGST and SGST calculation.
- Financial-year-based invoice numbering.
- Property-specific legal and GST information.

**Payment Data Security**
- No raw card numbers or CVVs are stored.
- Payment records retain transaction references from supported payment providers.

For detailed security controls and the production security checklist, refer to [`SECURITY.md`](SECURITY.md).

---

## Database Management & Backups

The platform includes database backup and restoration utilities.

### Automated Backup

```bash
bash scripts/backup-db.sh
```

Backup capabilities include:

- Compressed PostgreSQL database dumps.
- SHA-256 checksum generation.
- Optional offsite synchronization to AWS S3 or Cloudflare R2.
- Automatic cleanup of older local backups.

### Database Restoration

```bash
bash scripts/restore-db.sh \
  backups/dh_db_20261019_120000.sql.gz \
  --confirm
```

The restore script validates the backup checksum before performing restoration.

**Operational recommendation:** Always verify a backup and its restoration procedure before relying on it for disaster recovery.

---

## Performance & Load Testing

The project includes performance testing utilities for evaluating backend workloads and API responsiveness.

### k6

```bash
k6 run scripts/load-test-k6.js
```

Custom load configuration:

```bash
k6 run --vus 50 --duration 1m scripts/load-test-k6.js
```

### Locust

```bash
locust -f scripts/locustfile.py \
  --host http://127.0.0.1:8001
```

### Backend Optimization

The documented implementation includes:

- Database connection pooling.
- Query batching for selected endpoints.
- Memory caching for selected frequently accessed data.
- API response deduplication.
- Efficient database query patterns.

Performance targets and measurements should be evaluated against the actual production environment.

---

## Common Development Commands

| Command | Purpose |
|---|---|
| `npm run dev:all` | Start development services |
| `npm run check:all` | Run unified verification |
| `npm run test:hms` | Execute HMS backend tests |
| `npm run test:website` | Execute website frontend tests |
| `npm run test:website-api` | Execute website API tests |
| `npm run build:staff` | Build staff application |
| `npm run build:website` | Build public website |

---

## Production Initialization

Production environments do not automatically receive development demo data.

For first-time initialization, the repository provides dedicated production bootstrap and setup scripts.

```bash
python -m backend.app.seed.production_bootstrap \
  --users /tmp/users.json
```

After verifying the proposed changes and taking a database backup, the initialization process can be applied using the documented production bootstrap procedure.

**Important:** The `--apply` operation deletes existing HMS table data. Never execute it against a production database containing real reservations or operational records.

Refer to the production data initialization instructions in the project documentation before running these commands.

---

## Documentation

| Document | Description |
|---|---|
| `README.md` | Project overview and developer guide |
| `SECURITY.md` | Security architecture and checklist |
| `docs/DEPLOYMENT_GUIDE.md` | Production deployment |
| `docs/WEBSITE.md` | Public website documentation |
| `docs/specs/` | Technical specifications |

---

## Project Philosophy

TapMenu Open Hospitality Platform is designed around a simple engineering objective:

**One connected platform. One operational ecosystem. A consistent guest experience.**

By integrating guest acquisition, reservations, front-desk operations, financial workflows, restaurant ordering and kitchen operations, the platform aims to reduce operational fragmentation and provide a unified digital foundation for hospitality management.

---

<p align="center">
  <strong>TapMenu — Open Hospitality Platform</strong><br>
  Unified Hospitality Management System & Guest Digital Experience
</p>

---

## Authors & Maintainers

**TapMenu Open Hospitality Platform is developed and maintained by [TAPWEBS](https://tapwebs.in),** building practical software products, intelligent automation systems, and cybersecurity-driven digital solutions.

<p align="center">
  <strong>TapMenu · Powered by TAPWEBS</strong>
  <br>
  Integrated Hospitality. Smarter Operations. Better Experiences.
  <br><br>
  <a href="https://tapwebs.in">TAPWEBS Website</a>
</p>

---

<p align="center">
  <sub>© TAPWEBS. Licensed under the MIT License. See LICENSE and ATTRIBUTION.md for details.</sub>
</p>
