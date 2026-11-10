# 09-CHANNELS-WEBSITE-AND-INTEGRATIONS.md
# TapMenu HMS — Distribution Channels, Direct Website Booking Engine & External Integration Architecture

---

## 1. Document Control & Metadata
- **Document Identifier:** `DOC-HMS-009`
- **System Name:** TapMenu HMS
- **Version:** 2.0.0
- **Document Status:** Implementation-Ready Integration Specification
- **Primary Source:** `TapMenu_HMS_Final_Client_Specification(1).docx` (Sections 1, 2, 10, 14, 15, 22, 23)
- **Traceability Tag:** `FR-CHAN-*`, `API-WEB-*`, `INT-ADAPT-*`, `SEC-WEBHOOK-*`

---

## 2. Channel Management & Distribution Architecture

### 2.1 The Adapter Abstraction Pattern
`[SOURCE REQUIREMENT]` & `[ENGINEERING DECISION]`
To ensure that the core PMS never couples directly to a specific third-party OTA schema (e.g., Booking.com B.XML vs. Expedia QuickConnect vs. MakeMyTrip API), TapMenu HMS implements an **Adapter-Based Distribution Architecture**:

```mermaid
flowchart TD
    subgraph CoreHMS["Core HMS Engine (Source of Truth)"]
        INV[Inventory & Room State Manager]
        RATES[Rate Engine & Restriction Slabs]
        RES[Reservation Ingestion Engine]
    end

    subgraph ChannelAbstraction["Channel Manager Abstraction Layer"]
        C_SVC[Channel Manager Service]
        MAPPER[Room & Rate Plan Mapping Matrix]
        QUEUE[Sync Event Queue & Dead-Letter Queue]
    end

    subgraph Adapters["Provider Channel Adapters (Pluggable)"]
        ADAPT_BDC[Booking.com Adapter]
        ADAPT_AGODA[Agoda Adapter]
        ADAPT_MMT[MakeMyTrip / Goibibo Adapter]
        ADAPT_AIRBNB[Airbnb Adapter]
        ADAPT_GDS[GDS Switch Adapter (Future)]
    end

    subgraph ExternalOTAs["External Sales Channels"]
        EXT_BDC[(Booking.com API)]
        EXT_AGODA[(Agoda API)]
        EXT_MMT[(MakeMyTrip API)]
        EXT_AIRBNB[(Airbnb API)]
    end

    INV -->|Trigger on Inventory Change| C_SVC
    RATES -->|Trigger on Rate Change| C_SVC
    
    C_SVC --> MAPPER
    MAPPER --> QUEUE
    QUEUE --> ADAPT_BDC
    QUEUE --> ADAPT_AGODA
    QUEUE --> ADAPT_MMT
    QUEUE --> ADAPT_AIRBNB

    ADAPT_BDC <-->|Outbound ARI / Inbound Bookings| EXT_BDC
    ADAPT_AGODA <-->|Outbound ARI / Inbound Bookings| EXT_AGODA
    ADAPT_MMT <-->|Outbound ARI / Inbound Bookings| EXT_MMT
    ADAPT_AIRBNB <-->|Outbound ARI / Inbound Bookings| EXT_AIRBNB

    ADAPT_BDC -->|Normalized Reservation DTO| RES
    ADAPT_AGODA -->|Normalized Reservation DTO| RES
    ADAPT_MMT -->|Normalized Reservation DTO| RES
    ADAPT_AIRBNB -->|Normalized Reservation DTO| RES
```

---

## 3. Bidirectional Channel Synchronization (ARI & Inbound Bookings)

### 3.1 Outbound ARI (Availability, Rates & Inventory) Push
Whenever a room status changes, a booking is confirmed, or a rate restriction is updated in TapMenu HMS, the system publishes an **ARI Sync Event**:

1. **Payload Generation:**
   ```json
   {
     "property_id": "e4b3b123-4567-4890-a123-567890abcdef",
     "channel_id": "chan-bdc-001",
     "updates": [
       {
         "channel_room_code": "BDC_DLX_KING",
         "date_range": { "from": "2026-10-15", "to": "2026-10-20" },
         "available_count": 4,
         "rate_amount_minor": 450000,
         "currency": "INR",
         "restrictions": {
           "min_los": 2,
           "closed_to_arrival": false,
           "stop_sell": false
         }
       }
     ]
   }
   ```
2. **Retry & Dead-Letter Queue (DLQ):**
   - Outbound sync jobs execute via Celery workers with exponential backoff (retries: 10s, 30s, 2m, 10m).
   - If a channel API persistently fails after 5 attempts, the job moves to `channel_dead_letter_events` and raises a critical alert on the General Manager's dashboard.

### 3.2 Inbound Reservation Webhook Processing
1. External OTA posts reservation payload to `/api/v1/channels/{channel_id}/webhook`.
2. Adapter normalizes provider-specific JSON into internal `StandardReservationDTO`.
3. System verifies idempotency via OTA booking reference (`ota_reservation_code`).
4. System executes atomic inventory deduction in PostgreSQL.
5. Inbound booking acknowledged with `200 OK` in < 2 seconds.

---

## 4. Hotel Direct Website Integration API

`[SOURCE REQUIREMENT]`
The hotel website booking engine communicates with TapMenu HMS through a secure, public-facing REST API surface. The website holds zero independent inventory truth.

```
┌─────────────────────────────────────────────────────────────┐
│ HOTEL DIRECT WEBSITE (Next.js / Gatsby / WordPress)         │
│ - Date Search Bar                                           │
│ - Room Type Display & Amenity Gallery                       │
│ - Dynamic Price Quotation                                   │
│ - Guest Checkout Form                                       │
│ - Payment Gateway Modal (Razorpay / Stripe)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST (Public Surface)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ TAPMENU HMS PUBLIC API GATEWAY (/api/v1/*)                  │
│ - Strict Rate Limiting (60 req/min per IP)                  │
│ - CORS Allowed Origins (Configured Hotel Domains Only)      │
│ - Idempotency-Key Enforced on Booking Creation              │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Public Website API Surface Specification

| HTTP Method | API Path | Purpose | Query / Request Payload | Response Schema Summary |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/availability` | Search available rooms across date range | `?check_in=2026-10-15&check_out=2026-10-18&adults=2&children=1` | Array of available room types with available counts and lowest rate. |
| `GET` | `/api/v1/room-types` | Public catalog of room types & amenities | None (Property-scoped) | Room type titles, descriptions, max occupancy, photo URLs, amenity tags. |
| `GET` | `/api/v1/rates` | Detailed rate plan quotes & cancellation terms | `?room_type_id={id}&check_in={date}&check_out={date}` | Array of rate plans (EP, CP), inclusions, daily price breakdown, tax estimates. |
| `POST`| `/api/v1/reservations` | Create confirmed or pending direct reservation | Guest contact, room type, rate plan, dates, payment reference, `Idempotency-Key` | Booking reference (`RES-2026-1042`), status, payment verification status. |
| `GET` | `/api/v1/reservations/{code}` | Guest retrieves booking details | `?email={guest_email}` (Auth verification) | Stay dates, room type, payment status, cancellation eligibility. |
| `POST`| `/api/v1/reservations/{code}/cancel`| Guest requests direct cancellation | Reason, refund destination details | Cancellation fee calculated, refund initiated, confirmation code. |

---

## 5. Third-Party Hardware & Communication Integrations

`[SOURCE REQUIREMENT]` & `[PROPOSED]`
TapMenu HMS defines standardized adapter interfaces for ancillary operational hardware and communication gateways:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TAPMENU INTEGRATION ADAPTER BUS                                             │
└──────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────┘
       │              │              │              │              │
       ▼              ▼              ▼              ▼              ▼
┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐
│ COMMUNICATION││ PAYMENT      ││ ESC/POS      ││ KEY-CARD     ││ ACCOUNTING   │
│ - WhatsApp   ││ - Razorpay   ││ THERMAL      ││ ENCODERS     ││ EXPORTS      │
│ - Twilio SMS ││ - Pine Labs  ││ - Kitchen KOT││ - Dormakaba  ││ - Tally XML  │
│ - SendGrid   ││ - Stripe     ││ - Front Desk ││ - Salto      ││ - CSV GL     │
└──────────────┘└──────────────┘└──────────────┘└──────────────┘└──────────────┘
```

1. **Transactional Messaging (WhatsApp / SMS / Email):**
   - Automatically dispatched upon trigger events: `BOOKING_CONFIRMED`, `PRE_ARRIVAL_CHECKIN`, `PAYMENT_RECEIPT`, `CHECKOUT_INVOICE`.
2. **Thermal Printers (ESC/POS):**
   - Direct raw socket printing or USB/Ethernet print spooling for 58mm/80mm kitchen orders and cashier slips.
3. **Key-Card Access Encoders (Phase 2):**
   - Standardized TCP/IP interface connecting to RFID door-lock encoders (Assa Abloy / Dormakaba / Salto) to encode guest room keys at check-in.
