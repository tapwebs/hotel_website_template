# 13-FRONTEND-UI-UX-AND-SCREEN-SPECIFICATION.md
# TapMenu HMS — Frontend Client Architecture, Screen Specifications & Mobile UX Direction

---

## 1. Document Control & Metadata
- **Document Identifier:** `DOC-HMS-013`
- **System Name:** TapMenu HMS
- **Version:** 2.0.0
- **Document Status:** Implementation-Ready Frontend Specification
- **Primary Source:** `TapMenu_HMS_Final_Client_Specification(1).docx` (Sections 1, 4, 5, 6, 7, 8, 9, 10, 20, 24)
- **Target Authoritative Stack:** React 19 | TypeScript 5.x | Vite | Tailwind CSS v4 | React Router v7 | shadcn/ui | TanStack Query v5 | Zustand 5.x | FullCalendar v6 | React Hook Form + Zod
- **Traceability Tag:** `UI-FE-*`, `SCREEN-*`

---

## 2. Frontend Client Architecture & State Management

`[SOURCE REQUIREMENT]` & `[ENGINEERING DECISION]`
The frontend is architected as a high-performance Single Page Application (SPA) designed to feel like a modern, responsive operational SaaS rather than a legacy enterprise ERP.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ REACT 19 + TYPESCRIPT SINGLE PAGE APPLICATION (Vite Bundler)                │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROUTING TIER (React Router v7)                                              │
│ • Public Routes: /login, /forgot-password, /r/:roomToken (Guest In-Room QR)  │
│ • Authenticated Protected Shell: /app/* (Guarded by Permission Middleware)  │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ CLIENT STATE (Zustand 5.x)           │ SERVER STATE (TanStack Query v5)     │
│ • Active User & Auth Tokens          │ • API Caching & Background Refetch   │
│ • Active Property Context            │ • Optimistic Updates (Room Matrix)   │
│ • UI Theme & Sidebar Collapse State  │ • Automatic Query Invalidation       │
├──────────────────────────────────────┴──────────────────────────────────────┤
│ FORM & VALIDATION TIER: React Hook Form + Zod (Strict Typed DTO Validation) │
│ UI PRIMITIVES: Tailwind CSS v4 + Radix UI Primitives (shadcn/ui Suite)      │
│ REAL-TIME EVENT STREAM: Native WebSockets (KDS Tickets, Calendar Updates)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Permission-Aware UI Component Pattern
Frontend security guarantees UX clarity, while backend enforces authorization:

```tsx
// Reusable Permission Guard Component
import { useAuthStore } from "@/stores/authStore";

export const PermissionGate = ({ 
  permission, 
  children, 
  fallback = null 
}: { 
  permission: string; 
  children: React.ReactNode; 
  fallback?: React.ReactNode 
}) => {
  const hasPermission = useAuthStore((state) => state.hasPermission(permission));
  if (!hasPermission) return <>{fallback}</>;
  return <>{children}</>;
};
```

---

## 3. Comprehensive Screen Specifications Catalog

### 3.1 Screen: Visual Reservation Calendar & Availability Grid (`/app/calendar`)
- **Purpose:** Primary operational surface for visualizing room inventory, reservations, and room cleanliness simultaneously.
- **Authorized Roles:** `ROLE_SUPER_ADMIN`, `ROLE_GENERAL_MANAGER`, `ROLE_FRONT_DESK`.
- **Layout & Structure:**
  - **Top Toolbar:** Date navigator (Today, Previous/Next Week/Month), View Switcher (Timeline Day, Timeline 7-Day, Timeline 30-Day), Room Type Filter dropdown, Floor Filter, Search Input (Guest name / Booking code).
  - **Resource Timeline Grid (FullCalendar v6):**
    - Rows: Physical rooms grouped by Floor and Room Type. Each room label shows room number, type badge, and cleanliness badge (Green=Inspected, Orange=Dirty).
    - Columns: Calendar dates with current business date highlighted.
    - Grid Cells: Drag-and-drop reservation blocks color-coded by status (Blue=Confirmed, Green=Checked-in, Gray=Checked-out, Purple=Hold, Striped Red=Maintenance OOO).
- **Interactive Actions:**
  - Click on empty date cell $\rightarrow$ Opens "Quick Reservation Creation" drawer pre-filled with room and date.
  - Drag reservation block to new date or room $\rightarrow$ Triggers backend conflict validation modal; if valid, commits update.
- **States:**
  - *Loading:* Skeleton timeline grid.
  - *Empty:* "No rooms configured for selected filter."
  - *Conflict Toast:* "Cannot move reservation: Room 204 is occupied by another guest on 12-Oct."

---

### 3.2 Screen: Front Desk Operations Command Center (`/app/front-desk`)
- **Purpose:** Fast operational management of today's guest lifecycle.
- **Authorized Roles:** `ROLE_FRONT_DESK`, `ROLE_GENERAL_MANAGER`.
- **Layout & Structure:**
  - **Top Metric Cards:** Expected Arrivals (count), Expected Departures (count), In-House Guests (count), Available Clean Rooms (count).
  - **Tabbed Operational Workflows:**
    - Tab 1: **Arrivals (Today):** Table listing Guest Name, Booking Ref, Room Type, Assigned Room (or "Unassigned" dropdown), Advance Paid, Action Button: `[ Check-In ]`.
    - Tab 2: **Departures (Today):** Table listing Guest Name, Room #, Folio Balance (Paise $\rightarrow$ INR), Payment Status Badge, Action Button: `[ Settle & Checkout ]`.
    - Tab 3: **In-House Stays:** Table listing Room #, Guest, Check-in Date, Nights, Unbilled Balance, Credit Limit Alert, Action Button: `[ View Folio ]`.
- **Check-In Modal Workflow:**
  - Step 1: Guest verification & contact update.
  - Step 2: KYC Document Capture (File upload or webcam photo snapshot).
  - Step 3: Room selection (Restricted to `INSPECTED_READY` rooms of booked room type).
  - Step 4: Advance deposit verification & Key Card assignment reference.
  - Step 5: `[ Confirm Check-In ]` button $\rightarrow$ Transitions stay to active, prints registration card.

---

### 3.3 Screen: Master Guest Folio & Settlement (`/app/folios/:folioId`)
- **Purpose:** Complete transactional ledger review, departmental charge posting, split billing, and payment checkout.
- **Authorized Roles:** `ROLE_FRONT_DESK`, `ROLE_ACCOUNTANT`, `ROLE_GENERAL_MANAGER`.
- **Layout & Structure:**
  - **Header Banner:** Stay Context (Room 204 | Rahul Sharma | Check-in: 10-Oct | Check-out: 13-Oct | Billing Status: OPEN).
  - **Summary Metrics:** Total Charges: ₹23,100.00 | Total Payments: ₹12,000.00 | Net Balance Due: **₹11,100.00**.
  - **Dual-Pane Split Folio Manager:**
    - Pane A (Main Folio): Room tariffs, service charges, room taxes.
    - Pane B (Incidentals Folio): Restaurant dining, in-room QR orders, laundry, minibar.
    - Actions: Drag line items between Pane A and Pane B to separate corporate billing from personal expenses.
  - **Ledger Table:** Line #, Date/Time, Department, SAC/HSN Code, Description, Debit, Credit, Running Balance, Audited Actor.
  - **Action Footer:**
    - `[ + Post Manual Charge ]` (Laundry, Transport, Minibar).
    - `[ Apply Discount / Allowance ]` (Requires manager approval code).
    - `[ Collect Payment ]` (Cash, Credit Card, UPI, Bill-to-Company).
    - `[ Finalize & Generate GST Invoice ]` (Active only when Net Balance == ₹0.00).

---

### 3.4 Screen: Restaurant POS & Floor Plan (`/app/pos`)
- **Purpose:** Counter and table dining order management, KOT printing, and charge-to-room routing.
- **Authorized Roles:** `ROLE_FNB_CASHIER`, `ROLE_GENERAL_MANAGER`.
- **Layout & Structure:**
  - Left Pane (60%): Interactive Table Floor Plan (Tables T1–T12 with color-coded status badges) OR Menu Catalog Grid (filterable by Category: Starters, Mains, Drinks).
  - Right Pane (40%): Active Cart / Order Slip:
    - Order Type Selector: `[ Dine-In ]` `[ Room Service ]` `[ Takeaway ]`.
    - Item List: Item Name, Modifiers (e.g., "Extra Spicy"), Quantity, Line Price.
    - Subtotal, 5% F&B GST calculation, Net Total.
    - Action Buttons: `[ Send to Kitchen (KOT) ]`, `[ Print Bill ]`, `[ Pay Cash/UPI ]`, `[ Charge to Room ]`.
- **Charge to Room Dialog:**
  - Input Room Number (e.g., "204") $\rightarrow$ System fetches active guest name ("Rahul Sharma").
  - Cashier confirms guest signature on POS screen $\rightarrow$ Charge posted to Master Folio instantly.

---

### 3.5 Screen: Kitchen Display System (KDS) (`/app/kds/:stationId`)
- **Purpose:** Full-screen touch terminal for kitchen preparation stations (Main Kitchen, Grill, Bar).
- **Authorized Roles:** `ROLE_KITCHEN_STAFF`, `ROLE_GENERAL_MANAGER`.
- **Design Specifications:**
  - Dark mode by default for high-heat, high-glare environments.
  - Large touch targets (Minimum button height 64px).
  - Ticket Cards:
    - Header: Order #, Table # or Room #, Elapsed Timer (Green < 10m, Orange 10-20m, Flashing Red > 20m).
    - Body: Item checklist with modifiers in bold contrast text.
    - Footer: Touch action buttons: `[ Start Prep ]` $\rightarrow$ `[ Item Done ]` $\rightarrow$ `[ Bump Ticket ]`.

---

## 4. Mobile-First Operational Interfaces (Housekeeping & Maintenance)

`[SOURCE REQUIREMENT]`
Operational staff in corridors and mechanical rooms require a fast, touch-optimized mobile experience operable on smartphones under fluctuating Wi-Fi connectivity:

```
┌──────────────────────────────────────────────┐
│ TAPMENU MOBILE  •  ROOMS ASSIGNED (FLOOR 2)  │
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ ROOM 204  •  DELUXE KING                 │ │
│ │ Status: VACANT DIRTY  |  Checkout Clean  │ │
│ │ Priority: HIGH                           │ │
│ │                                          │ │
│ │ [ ▶ START CLEANING ]                     │ │
│ │ [ ⚠ REPORT DEFECT ]                      │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ ROOM 205  •  DELUXE TWIN                 │ │
│ │ Status: IN CLEANING                      │ │
│ │ Started: 14 mins ago                     │ │
│ │                                          │ │
│ │ [ ✓ MARK CLEANED ]                       │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 4.1 Mobile Design Invariants & Offline Conflict Protocol
1. **1-Tap State Advancements:** Large physical touch buttons allowing staff to transition room states (`Start Cleaning`, `Mark Cleaned`, `Approve Inspection`) with zero multi-level menu navigation.
2. **Native Camera Photo Capture:** Direct HTML5 camera integration for uploading maintenance defects and Lost & Found items directly to S3.
3. **Structured Offline Queueing:** Offline state transitions record a full command envelope (`command_id`, `device_id`, `user_id`, `created_at`, `client_sequence`, `idempotency_key`, `base_server_version`, `transition_requested`) in local IndexedDB.
4. **Deterministic Server Conflict Feedback:** Upon reconnecting, if the server encounters a version mismatch or illegal state transition (e.g., room was placed in `OUT_OF_ORDER` while device was offline), the server rejects the mutation with `409 Conflict` (`ROOM_STATE_CONFLICT`). The UI highlights the conflicting card in amber and notifies the staff member: *"Room 204 state changed on server (Out of Order). Cleaning update cancelled."* The client never blindly overwrites server state.
