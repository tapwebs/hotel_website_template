# TapMenu HMS — Backend Architecture & API Service

Production-grade, asynchronous modular monolithic backend for the **Dream Heavens Hotel Management System (HMS)**.

---

## 1. Technology Stack

* **Language:** Python 3.12+
* **Framework:** FastAPI 0.110+
* **Data Validation:** Pydantic v2
* **ORM & Database Driver:** SQLAlchemy 2.0+ (AsyncIO), `asyncpg` (PostgreSQL), `aiosqlite` (Local fallback & testing)
* **Migrations:** Alembic
* **Security & Auth:** JWT Bearer tokens (`PyJWT`), `bcrypt` password hashing
* **Testing:** Pytest, pytest-asyncio, HTTPX

---

## 2. Architecture & Directory Structure

```text
backend/
├── app/
│   ├── main.py                  # FastAPI app factory, CORS, exception handlers, lifecycle
│   ├── core/
│   │   ├── config.py            # Environment & Pydantic settings
│   │   ├── database.py          # Async database engine & session dependency
│   │   ├── security.py          # Bcrypt hashing & JWT encryption/verification
│   │   ├── dependencies.py      # Auth, permission, and property scope dependencies
│   │   └── errors.py            # Standardized error response envelope
│   ├── models/                  # SQLAlchemy 2.0 declarative database models
│   │   ├── organization.py      # Organizations, Properties, PropertySettings
│   │   ├── user.py              # Users, RBAC permissions
│   │   ├── room.py              # RoomTypes, RatePlans, Rooms, DailyInventory
│   │   ├── guest.py             # GuestProfile, GuestDocument (KYC)
│   │   ├── reservation.py       # RoomHold, Reservation, ReservationRoom, Stay
│   │   ├── folio.py             # MasterFolio, FolioLineItem, Payment, Invoice
│   │   ├── operations.py        # HousekeepingTask, MaintenanceTicket
│   │   ├── pos.py               # POSTable, MenuItem, POSOrder
│   │   └── audit.py             # AuditLog
│   ├── schemas/                 # Pydantic v2 request/response DTO schemas
│   ├── services/                # Business logic domain layer
│   ├── api/                     # REST API routers (/api/v1/*)
│   ├── core/tax.py              # GST rates (rooms 5% up to Rs 7,500/night else 18%, restaurant 5%)
│   ├── core/numbering.py        # Collision-resistant folio / booking numbers, financial-year helper
│   └── seed/
│       ├── demo_seed.py         # Development-only demo property, rooms and staff logins
│       ├── production_bootstrap.py  # Wipe demo data + create real staff accounts (see section 5)
│       ├── production_setup.py  # Idempotent property profile, room types, rate plans and rooms
│       └── users.example.json   # Format of the staff accounts file
├── alembic/                     # Database migration revisions & environment
├── tests/                       # Automated async test suites (230+ tests)
├── alembic.ini                  # Alembic CLI configuration
├── requirements.txt             # Python dependencies
├── .env.example                 # Development environment variables
├── .env.production.example      # Production environment variables (Coolify)
└── README.md
```

---

## 3. Getting Started

### 3.1 Prerequisites
* Python 3.12+
* Virtual environment (recommended)

### 3.2 Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### 3.3 Configure Environment
Copy `.env.example` to `.env`:
```bash
cp backend/.env.example backend/.env
```

### 3.4 Run Database Migrations
Apply the latest Alembic schema migrations:
```bash
cd backend
alembic upgrade head
```

### 3.5 Run the Backend Server
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The interactive API documentation is immediately available at:
* Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
* ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 4. Automated Testing

Run the comprehensive async test suite covering Authentication, Rooms, Guests, Reservations, Front Desk (Check-In / Check-Out), and Folios & Payments:

```bash
HMS_INTEGRATION_API_KEY=test-integration-key-0123456789abcdef pytest backend/tests -v
```
The integration tests send this key to the website-sync endpoints, so it must be set (CI sets it too).

---

## 4a. Server-sent F&B receipts (optional)

Off by default. When a provider is configured, a paid F&B order with a customer phone gets a short WhatsApp or SMS receipt once payment is
confirmed (counter settle, or Razorpay verify/webhook). A failed send never affects the sale, and each order is sent once
(`pos_orders.receipt_sent_at`). Staff can resend with `POST /pos/orders/{id}/receipt`.

| Variable | Purpose |
|---|---|
| `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | WhatsApp Cloud API credentials (WhatsApp is used when both are set) |
| `WHATSAPP_RECEIPT_TEMPLATE`, `WHATSAPP_RECEIPT_LANG` | Approved template name and language. Body variables in order: guest first name, order number, total, restaurant. Without a template a plain text message is sent, which WhatsApp only delivers inside the guest's 24-hour window |
| `MSG91_AUTH_KEY`, `MSG91_RECEIPT_TEMPLATE_ID` | MSG91 SMS flow (used when WhatsApp is not configured). Template variables `VAR1..VAR4` = name, order number, total, restaurant; needs DLT approval in India |
| `RECEIPT_DEFAULT_COUNTRY_CODE` | Added to 10-digit numbers (default `91`) |

## 5. Production accounts and rooms
No demo accounts or demo data exist in production: the demo seed only runs when `APP_ENV=development`.

```bash
# Staff accounts (format: app/seed/users.example.json; keep the real file out of git)
python -m backend.app.seed.production_bootstrap --users /tmp/users.json            # dry run
python -m backend.app.seed.production_bootstrap --users /tmp/users.json --apply \
    --rooms DLX_PALACE=101-110 --rooms ROYAL_SUITE=301-310                          # DELETES all HMS rows first

# Rooms / room types / property profile later on (safe to repeat, deletes nothing)
python -m backend.app.seed.production_setup --rooms ROYAL_SUITE=311-312
```
Room type codes must match `WEBSITE_ROOM_MAP` (`DLX_PALACE`, `ROYAL_SUITE`).
