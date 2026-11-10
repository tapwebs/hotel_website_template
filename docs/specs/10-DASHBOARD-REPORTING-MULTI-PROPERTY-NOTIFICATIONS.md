# 10-DASHBOARD-REPORTING-MULTI-PROPERTY-NOTIFICATIONS.md
# TapMenu HMS — Operations Dashboard, Owner BI, Financial Reporting, Multi-Property Architecture & Notification Engine

---

## 1. Document Control & Metadata
- **Document Identifier:** `DOC-HMS-010`
- **System Name:** TapMenu HMS
- **Version:** 2.0.0
- **Document Status:** Implementation-Ready Engineering Specification
- **Primary Source:** `TapMenu_HMS_Final_Client_Specification(1).docx` (Sections 5, 13, 16, 17)
- **Traceability Tag:** `FR-DASH-*`, `FR-BI-*`, `FR-REP-*`, `FR-NOTIF-*`, `ARCH-MULTI-*`

---

## 2. Operations Dashboard & Front Office Command Center

`[SOURCE REQUIREMENT]`
The Operations Dashboard serves as the real-time morning-to-night operational command center for front desk agents and duty managers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TAPMENU OPERATIONS COMMAND CENTER  •  JAIPUR RESORT  •  10 OCT 2026         │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤
│ OCCUPANCY    │ ARRIVALS     │ DEPARTURES   │ IN-HOUSE     │ OUTSTANDING     │
│ 84.2%        │ 18 Expected  │ 12 Pending   │ 42 Rooms     │ ₹34,200.00      │
│ 42/50 Rooms  │ (4 Checked)  │ (8 Settled)  │ 88 Guests    │ (3 Over Limit)  │
├──────────────┴──────────────┴──────────────┴──────────────┴─────────────────┤
│ ROOM STATUS MATRIX WIDGET                                                   │
│ [Ready: 8]   [Occupied: 42]   [Dirty: 6]   [Cleaning: 2]   [OOO/OOS: 2]     │
├─────────────────────────────────────────────────────────────────────────────┤
│ CRITICAL OPERATIONAL ALERTS & PRIORITY QUEUE                                │
│ • ⚠ Room 103: AC failure reported (HVAC Maintenance Ticket #142 - High)     │
│ • ⚠ Room 204: Folio unbilled balance exceeds credit threshold (₹18,500 due)  │
│ • ℹ VIP Arrival at 15:00: Mr. Vikram Oberoi (Suite 401 - Amenities Ready)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ QUICK ACTION LAUNCHERS                                                      │
│ [ + New Reservation ]  [ Walk-In Check-In ]  [ Collect Payment ]  [ Room Move ]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Core Dashboard Widgets

| Widget Identifier | Operational Metrics Displayed | Underlying Event Trigger / Refresh Rate |
| :--- | :--- | :--- |
| **Occupancy Gauge** | Total occupied rooms $\div$ Total sellable rooms; live percentage and trend arrow vs. previous day. | Real-time WebSocket event on check-in, checkout, or OOO change. |
| **Arrivals Board** | Count of expected arrivals today; breakdown: Assigned, Unassigned, VIP, Checked-in, Advance paid. | Updates on booking creation or arrival check-in. |
| **Departures Board** | Count of departing rooms today; breakdown: Settled, Unsettled, Late checkout approved. | Updates on checkout and payment posting. |
| **Room Matrix View** | Color-coded mini-grid displaying real-time physical room states (Green=Ready, Red=Occupied, Orange=Dirty, Gray=OOO). | Instant push from Housekeeping mobile updates. |
| **Financial Pulse** | Today's room revenue, F&B revenue, ancillary collections, and total ledger receivables. | Recalculated on every payment and charge posting. |

---

## 3. Executive Business Intelligence (BI) & Key Performance Metrics

`[SOURCE REQUIREMENT]`
The Executive BI suite translates raw transactional data into actionable commercial indicators for hotel owners, general managers, and asset holding groups:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ OWNER COMMAND CENTER (EXECUTIVE BI)                                         │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────────┐ │
│ │ OCCUPANCY │ │ ADR       │ │ REVPAR    │ │ GROSS REV │ │ OUTSTANDING AR  │ │
│ │ 84.2%     │ │ ₹5,487.00 │ │ ₹4,620.00 │ │ ₹2.14 L   │ │ ₹34,200.00      │ │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘ └─────────────────┘ │
│                                                                             │
│   REVENUE MIX                  CHANNEL CONTRIBUTION        CREDIT AGING     │
│   • Rooms: 68%                 • Direct Web: 35%           • 0-30 Days: 82% │
│   • F&B Dining: 20%            • Booking.com: 28%          • 31-60 Days: 12%│
│   • Room Service: 8%           • MakeMyTrip: 22%           • 61+ Days: 6%   │
│   • Ancillary/Spa: 4%          • Walk-in/Phone: 15%                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Standard Hospitality KPI Formulas

$$\text{Occupancy Rate (\%)} = \left( \frac{\text{Total Rooms Sold / Occupied}}{\text{Total Physical Rooms} - \text{Out of Order (OOO) Rooms}} \right) \times 100$$

$$\text{Average Daily Rate (ADR)} = \frac{\text{Total Net Room Revenue (Excluding Taxes \& Ancillaries)}}{\text{Number of Paid Rooms Sold}}$$

$$\text{Revenue Per Available Room (RevPAR)} = \frac{\text{Total Net Room Revenue}}{\text{Total Sellable Rooms}} = \text{Occupancy Rate} \times \text{ADR}$$

$$\text{Average Ticket Size (F\&B)} = \frac{\text{Total Net Restaurant \& Room Service Sales}}{\text{Total Covers / Closed Orders}}$$

---

## 4. Operational & Compliance Reports Suite

`[SOURCE REQUIREMENT]`
All reports support multi-format export (PDF, CSV, Excel) with granular access control:

| Report Code | Title / Scope | Key Operational & Financial Data Fields |
| :--- | :--- | :--- |
| `REP-FIN-001` | **Daily Manager Flash Report** | Room revenue, F&B revenue, laundry, minibar, cash collections, card settlements, UPI, BTC transfers, expected cash variance. Generated automatically by Night Audit. |
| `REP-TAX-001` | **GST Tax Liability Report** | Taxable values, CGST, SGST, IGST totals split by configured SAC code (e.g., SAC `9963` accommodation vs. `996331` dining `[REFERENCE CONFIGURATION — MUST BE VALIDATED BEFORE PRODUCTION]`). Compliant with GSTR-1 filing requirements. |
| `REP-RES-001` | **Reservation Forecast & Pace** | 30/60/90-day forward-looking booking pace, confirmed nights, projected revenue, and unconstrained demand. |
| `REP-OPS-001` | **Housekeeping Productivity** | Cleaning turnaround time per housekeeper, rooms inspected, re-cleans ordered, linen consumption per shift. |
| `REP-MAINT-001`| **Maintenance Downtime Log** | Room outage durations, equipment defect frequencies, mean time to repair (MTTR), lost revenue due to OOO blocking. |
| `REP-AR-001` | **Corporate Credit Aging** | Outstanding City Ledger balances grouped by 0–30, 31–60, 61–90, and 90+ days past due date with contact references. |

---

## 5. Multi-Property Architecture & Tenant Isolation

`[SOURCE REQUIREMENT]`
TapMenu HMS models organizations operating single boutique hotels or national hospitality chains under a unified database with strict tenant partitioning:

```
┌─────────────────────────────────────────────────────────┐
│ ORGANIZATIONS (Brand / Enterprise Tenant)               │
│ e.g., "Dream Heavens Group"                             │
└────────────────────────────┬────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        ▼                                         ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│ PROPERTY: JAIPUR HERITAGE     │ │ PROPERTY: GOA BEACH RESORT    │
│ • Independent Room Inventory  │ │ • Independent Room Inventory  │
│ • Property-Specific GSTIN     │ │ • Property-Specific GSTIN     │
│ • Local Rate Plans & Seasons  │ │ • Local Rate Plans & Seasons  │
│ • Local Housekeeping Staff    │ │ • Local Housekeeping Staff    │
└───────────────────────────────┘ └───────────────────────────────┘
```

### 5.1 Multi-Property Isolation Enforcements
1. **Row-Level Partitioning:** Every core database table (`rooms`, `reservations`, `master_folios`, `orders`, `payments`, `housekeeping_tasks`) possesses a non-nullable `property_id` foreign key.
2. **FastAPI Tenant Scoping Middleware:**
   - Active property extracted from user session context or `X-Property-ID` request header.
   - Database queries automatically append `.filter_by(property_id=active_property_id)`.
3. **Cross-Property Super Admin Switcher:**
   - Users with `ROLE_SUPER_ADMIN` can switch active property context seamlessly from the header dropdown without logging out.
   - Group Executive BI displays aggregated multi-property comparisons (Occupancy, ADR, Gross Revenue per property).

---

## 6. Notification & Transactional Messaging Engine

`[SOURCE REQUIREMENT]`
The Notification Engine delivers event-driven messages across WhatsApp, SMS, and Email:

```mermaid
flowchart TD
    EVT[Business Event Trigger<br/>e.g., BOOKING_CONFIRMED] --> TEMPL[Template Selector & Variable Resolver]
    TEMPL --> PREP[Compose Message Payload]
    PREP --> ROUTE{Dispatch Channel}
    
    ROUTE -->|WhatsApp| WA[WhatsApp Business API Adapter]
    ROUTE -->|SMS| SMS[Twilio / SMS Gateway Adapter]
    ROUTE -->|Email| MAIL[SendGrid / SMTP Mailer]
    
    WA --> DISP[Celery Async Task Queue]
    SMS --> DISP
    MAIL --> DISP
    
    DISP --> SENT[External Gateway Transmission]
    SENT --> STATUS{Delivery Status}
    STATUS -->|Delivered| LOG[Record in notification_deliveries Table]
    STATUS -->|Failed| RETRY[Exponential Backoff Retry Worker (3x)]
```

### 6.1 Transactional Notification Matrix

| Event Trigger | Target Recipient | Channels Supported | Key Data Variables Injected |
| :--- | :--- | :--- | :--- |
| `BOOKING_CONFIRMED` | Guest | WhatsApp, Email, SMS | Guest Name, Booking Reference, Check-in Date, Nights, Room Type, Deposit Paid, Directions. |
| `PRE_ARRIVAL_REMINDER`| Guest | WhatsApp, SMS | Check-in Time, Digital KYC Pre-registration Link, Special Requests. |
| `CHECKIN_WELCOME` | Guest | WhatsApp | Room Number, Wi-Fi Credentials, In-Room QR Digital Dining Link (`/r/:token`). |
| `PAYMENT_RECEIPT` | Guest / Company | Email, WhatsApp | Payment Amount, Transaction ID, Payment Method, Remaining Folio Balance. |
| `CHECKOUT_INVOICE` | Guest / Corporate | Email | Attached Finalized Sequential GST Tax Invoice (PDF). |
| `MAINTENANCE_ALERT` | Maintenance Staff | In-App, Push, SMS | Defect Category, Room Number, Priority, Technician Assigned. |
