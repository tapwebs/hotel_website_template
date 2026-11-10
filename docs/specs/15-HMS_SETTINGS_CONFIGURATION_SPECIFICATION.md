# HMS SETTINGS & CONFIGURATION SPECIFICATION

## TapMenu HMS — Hotel Management System

**Scope:** `/app/settings`  
**Status:** Implementation-Ready UI/UX + Functional Specification  
**Reference:** TapMenu settings screenshots are UX/information-architecture inspiration only. HMS specifications and current HMS product boundary are authoritative.

---

## 1. Purpose

`/app/settings` is the centralized **HMS Configuration Control Plane**.

It configures property identity, hotel policies, reservations/inventory behavior, rooms/housekeeping rules, financial configuration, payments, channels, communications, security, integrations, and multi-property behavior.

**Settings must configure the HMS; Settings must not operate the HMS.**

Do not recreate operational modules inside Settings.

---

## 2. Settings Categories

Use these 11 categories:

1. **Property & Identity**
2. **Hotel Operations**
3. **Reservations & Inventory**
4. **Rooms & Housekeeping**
5. **Rates, Taxes & Billing**
6. **Payments & Night Audit**
7. **Channels & Booking Engine**
8. **Guest Experience & Communications**
9. **Security & Access**
10. **Integrations & Webhooks**
11. **Organization & Multi-Property**

`Organization & Multi-Property` is visible only to users with organization-level permission.

---

## 3. Core Boundary

| Existing Module | Settings Controls |
|---|---|
| Reservations | cancellation, modification, holds, booking policies |
| Calendar | inventory behavior and restrictions |
| Front Desk | check-in/out rules, overrides, approvals |
| Rooms | room status and OOO/OOS policies |
| Housekeeping | task automation and inspection rules |
| Maintenance | outage automation and resolution rules |
| Guest 360 | KYC/data policies |
| Folio | discounts, splits, voids, invoice behavior |
| Payments | methods, deposits, refunds |
| Night Audit | audit/reconciliation policies |
| Staff & Roles | RBAC and approval configuration |
| Booking Engine | booking configuration |
| Channels | OTA/channel configuration |
| F&B Analytics | external POS/KDS integration configuration |
| Notifications | providers, templates, triggers |

### Never duplicate these inside Settings

- Reservation Calendar
- Room Matrix
- Housekeeping Board
- Maintenance Tickets
- Guest 360 operational screen
- Folio transactions
- Payment transactions
- Night Audit execution
- Reports
- Staff Directory
- OTA reservation management
- Actual Booking Engine
- POS
- KDS

---

# 4. Global Settings UX

Use a structure inspired by the supplied TapMenu reference:

```text
Hotel System Settings                         [Save Changes]

[Property] [Operations] [Reservations] [Rooms] [Financial]
[Payments] [Channels] [Communications] [Security]
[Integrations] [Organization]
```

Use:

- grouped cards
- clear section hierarchy
- status badges
- controlled forms
- drawers for focused configuration
- confirmation dialogs for destructive/sensitive changes
- inline validation
- loading/error/success states
- Save / Revert behavior

Do not copy restaurant/POS-specific TapMenu functionality.

---

# 5. Configuration Health

At the top of Settings:

```text
SYSTEM CONFIGURATION

● Property Profile       Complete
● Operations             Complete
● Reservations           82%
● Financial              Complete
● Payments               Needs Setup
● Booking Channels       2 / 4 Connected
● Communications         1 / 3 Connected
● Security               Complete
● Integrations           3 / 5 Connected

⚠ Configuration items require attention
[Review Configuration]
```

This is a configuration-health indicator, not another dashboard.

---

# 6. PROPERTY & IDENTITY

## Property Identity

Fields:

- Property Name
- Legal Entity Name
- Property Code
- Hotel Type
- Star Classification
- Property Status

## Legal & Registration

Fields:

- GSTIN
- PAN
- Legal Entity
- Registered Address
- State
- State Code
- City
- PIN Code
- Country
- Applicable regulatory registration fields

Do not hardcode regulatory fields that are not universally applicable.

## Localization

Fields:

- Currency
- Timezone
- Date Format
- Time Format
- First Day of Week
- Default Language
- Secondary Language

Example:

```text
Currency       INR ₹
Timezone       Asia/Kolkata
Date Format    DD/MM/YYYY
Time Format    24 Hour
First Day      Monday
Language       English
Secondary      Hindi
```

## Property Branding

Fields:

- Hotel Logo
- Light Logo
- Dark Logo
- Favicon
- Primary Brand Color
- Secondary Brand Color
- Invoice Logo
- Booking Engine Logo
- Email Header Logo

---

# 7. HOTEL OPERATIONS

## Standard Stay Times

- Standard Check-in Time
- Standard Check-out Time
- Early Check-in Allowed
- Early Check-in Grace
- Late Check-out Allowed
- Late Check-out Grace

## Hotel Business Date

Display:

- Current Business Date
- Last Night Audit
- Next Audit Required
- Business Date Control

The authoritative hotel business date remains controlled by Night Audit. Ordinary users must not manually alter it.

## Overbooking Policy

- Allow Overbooking
- Maximum Overbooking Percentage
- Apply Per Room Type / Property
- Manager Approval Required
- Applicable Booking Sources

Example:

```text
Allow Overbooking          OFF
Maximum Overbooking        0%
Manager Approval           ON
```

## Guest / Stay Policies

- Allow Same-Day Booking
- Allow Walk-In Booking
- Allow Same-Day Cancellation
- Allow Reservation Modification
- Allow Room Move After Check-in
- Require Manager Approval for Room Upgrade
- Require Manager Approval for Rate Override

---

# 8. RESERVATIONS & INVENTORY

## Reservation Policies

- Default Reservation Status
- Default Booking Source
- Default Rate Plan
- Cancellation Policy
- No-Show Policy
- Modification Policy
- Reservation Hold Duration
- Automatically Release Expired Holds

Example:

```text
Hold Duration             10 minutes
Auto-release holds        ON
```

## Inventory Rules

- Inventory Mode
- Availability Calculation
- Allow Partial Availability
- Allow Overbooking
- Inventory Release Rules

Inventory release events:

- Cancellation
- No-show
- Expired hold

Technical implementation details such as PostgreSQL locks or Redis must not be exposed as ordinary hotel settings.

## Booking Sources

- Direct Website
- Booking.com
- MakeMyTrip
- Agoda
- Corporate
- Travel Agent
- Phone
- Walk-in
- Other

Per-source configuration:

- Enabled
- Display Name
- Commission %
- Default Rate Plan
- Default Cancellation Policy

---

# 9. ROOMS & HOUSEKEEPING

This section configures room/housekeeping behavior; it does not replace Rooms Matrix or Housekeeping.

## Room Status Policy

Use authoritative domain terminology:

```text
VACANT_DIRTY
      ↓
IN_CLEANING
      ↓
CLEANED
      ↓
INSPECTED_READY
```

Configuration:

- Inspection Required
- Allow Front Desk Assignment Before Inspection
- Supervisor Override

Do not introduce alternate UI-only state names such as `DIRTY`, `CLEAN`, or `CLEANING` if the domain uses the above codes.

## Room Availability / Outage

- Allow OOS Rooms to Remain Sellable
- Allow OOO Rooms to Remain Sellable
- Require Reason for OOS
- Require Reason for OOO
- Require Manager Approval

## Housekeeping

- Auto-create Departure Cleaning Task
- Auto-create Stayover Task
- Auto-create Inspection Task
- Require Photo on Completion
- Supervisor Inspection Required
- Priority Rules

Example:

```text
VIP                  → High
Early Arrival        → High
Standard Departure   → Normal
```

## Maintenance

- Automatically Mark Room OOS on Critical Ticket
- Require Resolution Note
- Require Completion Photo
- Require Manager Approval Before Returning OOS Room

---

# 10. RATES, TAXES & BILLING

## Rate Engine

- Default Rate Display: Tax Inclusive / Exclusive
- Base Rate Source
- Allow Manual Rate Override
- Rate Override Approval
- Minimum Rate
- Maximum Rate

## Tax Rules

Replace the current read-only tax cards with a real configurable table:

```text
┌──────────┬──────────────────┬─────────┬────────┬─────────┐
│ SAC      │ Service          │ Rate    │ Status │ Actions │
├──────────┼──────────────────┼─────────┼────────┼─────────┤
│ 996311   │ Accommodation    │ 12%     │ Active │ Edit    │
│ 996331   │ F&B              │ 5%      │ Active │ Edit    │
└──────────┴──────────────────┴─────────┴────────┴─────────┘

[+ Add Tax Rule]
```

Tax fields:

- Tax Name
- SAC/HSN
- Tax Type
- CGST %
- SGST %
- IGST %
- Effective From
- Effective Until
- Inclusive / Exclusive
- Active

Tax values are configurable/reference data and must be validated against the hotel's applicable tax configuration before production. Do not present example values as universally correct.

## Folio Configuration

- Default Folio Type
- Allow Split Folio
- Allow Discount
- Discount Approval Required
- Allow Allowance
- Void Approval Required
- Negative Folio Balance

## Invoice Configuration

- Invoice Prefix
- Invoice Number Format
- Invoice Logo
- Invoice Footer
- Show GSTIN
- Show SAC/HSN
- Show Tax Breakdown
- Show Guest Address

---

# 11. PAYMENTS & NIGHT AUDIT

## Payment Methods

- Cash
- Credit Card
- Debit Card
- UPI
- Bank Transfer
- Payment Gateway
- Corporate Credit
- Other

Per method:

- Enabled
- Display Name
- Settlement Account
- Require Reference

## Deposit Policy

- Require Deposit
- Default Deposit %
- Allow Manual Deposit Override
- Manager Approval Required

## Refund Policy

- Allow Refund
- Refund Approval Level
- Maximum Front Desk Refund
- Refund Above Limit
- Require Refund Reason

Example:

```text
Allow Refund                 ON
Approval                     Manager
Front Desk Refund Limit      ₹10,000
Above Limit                  Manager Approval
Refund Reason                Required
```

## Night Audit Configuration

- Auto-start Audit
- Audit Cut-off Time
- Require Payment Reconciliation
- Require Cash Reconciliation
- Require Unposted Charge Check
- Require Outstanding Folio Check
- Auto-advance Business Date

Settings configure Night Audit behavior; they do not replace the Night Audit execution screen.

---

# 12. CHANNELS & BOOKING ENGINE

## Direct Booking Engine

- Booking Engine Enabled
- Public Booking API Enabled
- Allow Direct Booking
- Allow Modification
- Allow Cancellation
- Hold Duration
- Payment Required
- Instant Confirmation

## Channel Distribution

Display connection state:

```text
Direct Website       ● Connected
Booking.com           ● Connected
MakeMyTrip            ● Connected
Agoda                 ○ Not Connected
```

Each channel opens a focused configuration drawer.

Example:

```text
BOOKING.COM

Connection             Connected
Property ID             ••••••••
API Status              Healthy
Last Sync               15 Oct 2026 14:32

Inventory Sync          ON
Rate Sync               ON
Restriction Sync        ON
Reservation Sync        ON

[Test Connection]
[Disable Integration]
```

Never expose credentials in plaintext.

## Website API

- API Status
- API Version
- Public Booking Endpoint
- Rate Availability
- Reservation Creation
- Modification
- Cancellation
- API Keys
- Webhook Secret
- Allowed Origins

Secrets must be masked.

---

# 13. GUEST EXPERIENCE & COMMUNICATIONS

## Communication Providers

Provider categories:

- Email
- SMS
- WhatsApp

Example:

```text
Email       ● Connected
SMS         ● Connected
WhatsApp    ○ Not Connected
```

## Event Notifications

- Booking Confirmation
- Modification Confirmation
- Cancellation Confirmation
- Deposit Receipt
- Pre-arrival Reminder
- Check-in Information
- Payment Receipt
- Invoice
- Checkout Confirmation

## Message Templates

```text
Booking Confirmation       Active
Cancellation              Active
Pre-arrival                Active
Check-in                   Active
Payment Receipt            Active
Invoice                    Active
Checkout                   Active
```

Use an Edit Template drawer/modal.

Templates must support configurable hotel content and event-based triggers.

---

# 14. SECURITY & ACCESS

## Authentication

- Session Timeout
- MFA Policy
- Password Policy
- Login Rate Limiting
- Concurrent Session Policy

## Manager Approval Policies

- Rate Override
- Discount Above Limit
- Folio Void
- Refund
- Room Upgrade
- Room OOO/OOS
- Reservation Cancellation Override
- Payment Adjustment
- Permission Changes

## Audit Configuration

Configurable audit metadata:

- Record IP Address
- Record User ID
- Record Timestamp

Sensitive actions:

- Discounts
- Refunds
- Rate Changes
- Reservation Cancellation
- Folio Void
- Cash Actions
- Permission Changes
- Configuration Changes

Settings configure audit behavior; the actual audit log remains a separate interface.

---

# 15. INTEGRATIONS & WEBHOOKS

## Payment Gateways

Support configuration/status for gateways such as:

- Razorpay
- Pine Labs

Fields:

- Gateway
- Test / Production Mode
- Key ID
- Secret
- Webhook
- Connection Verification

Credentials must be masked.

## External F&B Integration

Current product boundary:

> POS/KDS are external systems. HMS consumes F&B analytics, operational statistics and nightly folio reconciliation.

Example:

```text
EXTERNAL F&B INTEGRATION

POS Provider
External POS

Connection
Connected

Analytics Sync
ON

Operational Statistics
ON

Nightly Folio Reconciliation
ON

Last Sync
15 Oct 2026 14:40

Webhook Status
Healthy
```

Do not make HMS the owner of external POS/KDS functionality.

## Webhooks

- Inbound Webhooks
- Booking Events
- Payment Events
- Channel Events
- F&B Events
- Signature Verification
- Idempotency
- Retry Policy

Example:

```text
Webhook Security
Signature Verification

Idempotency
Database Authoritative

Retry Policy
Enabled
```

Provide navigation to a separate webhook log/test interface where implemented.

---

# 16. ORGANIZATION & MULTI-PROPERTY

Only organization-authorized users see this tab.

## Property Management

```text
PROPERTIES

Dream Heavens Jaipur Palace & Spa     Active
Dream Heavens Udaipur Resort          Active
Dream Heavens Jodhpur                 Active

[+ Add Property]
```

Actions:

- Edit Property
- Configure Property
- Deactivate Property

## Organization Defaults

Possible defaults:

- Currency
- Timezone
- Notification Policy
- Security Policy
- Invoice Configuration
- Approval Policies

Property-level settings override organization defaults where supported.

---

# 17. SAVE / REVERT / VALIDATION

Do not use uncontrolled `defaultValue` inputs or browser `alert()` for application feedback.

Required flow:

```text
Edit
 ↓
Unsaved Changes
 ↓
Save Changes
 ↓
Client Validation
 ↓
Permission Check
 ↓
Server Validation
 ↓
Persist Configuration
 ↓
Create Audit Event
 ↓
Success State
```

Provide:

- Save
- Cancel/Revert
- Unsaved changes indicator
- Validation errors
- Loading state
- Success state
- Error state

Sensitive settings may require:

```text
Save
 ↓
Manager Authorization
 ↓
Reason
 ↓
Persist
 ↓
Audit Event
```

---

# 18. PERMISSION MODEL

Settings must be permission-aware.

Suggested permission groups:

```text
settings:view
settings:edit
settings:financial
settings:tax
settings:payments
settings:channels
settings:security
settings:integrations
settings:organization
```

Frontend permission gates are for UX.

Backend authorization remains the security boundary.

Never grant access because a frontend button is hidden/shown.

---

# 19. SENSITIVE DATA

Never expose secrets in plaintext.

Examples:

- Payment gateway secret
- Channel API secret
- Webhook secret
- SMTP password
- WhatsApp credentials
- API private keys

Display masked values:

```text
••••••••••••••••
```

Use controlled rotation/update behavior.

---

# 20. AUDIT REQUIREMENTS

Sensitive configuration changes must be auditable.

Example:

```text
User:
frontdesk01

Action:
TAX_RULE_UPDATED

Resource:
SAC 996311

Old:
12%

New:
18%

Reason:
Manager-approved tax configuration change

Timestamp:
2026-10-15T14:32:10+05:30

IP:
Recorded
```

At minimum audit:

- Tax changes
- Rate-policy changes
- Refund-policy changes
- Approval-policy changes
- Channel configuration changes
- Payment gateway changes
- Notification provider changes
- Security changes
- RBAC-related changes
- Property identity changes
- Operational policy changes

---

# 21. UX REQUIREMENTS

Every setting should follow:

```text
Category
  ↓
Section
  ↓
Setting
  ↓
Description
  ↓
Control
```

Use descriptions for non-obvious policies.

Example:

```text
Allow Room Assignment Before Inspection

Allow Front Desk to assign rooms that have not
yet passed housekeeping inspection.

[OFF]
```

Sensitive/destructive settings require confirmation.

Examples:

- Disable channel
- Disable payment gateway
- Change tax rule
- Enable overbooking
- Disable approval
- Change security policy

Avoid exposing implementation jargon such as PostgreSQL, Redis, Celery or internal queue names to normal hotel users.

---

# 22. RESPONSIVE REQUIREMENTS

Settings must work on:

- Desktop
- Tablet
- Mobile

Desktop:
- tab navigation
- two-column configuration cards where appropriate

Tablet:
- adaptive one/two-column layout

Mobile:
- horizontally scrollable category navigation
- single-column cards
- sticky Save action

Minimum interactive touch target: approximately 44×44px.

---

# 23. DO NOT COPY FROM TAPMENU REFERENCE

The supplied TapMenu screenshots are reference only.

Do NOT copy restaurant-specific:

- Store Handle
- Restaurant feature modules
- Restaurant coupons
- Restaurant loyalty
- Rewards/wheel
- Menu-specific configuration
- Restaurant hours
- Thermal printer configuration as HMS-owned POS
- KDS feature toggles
- Kitchen audio controls
- Restaurant manager PIN workflow
- Restaurant menu branding
- Restaurant PWA configuration
- Counter settings
- Table settings

Use the reference only for organization, hierarchy, cards, tabs, status indicators and focused configuration interactions.

---

# 24. CURRENT HMS PRODUCT BOUNDARY

```text
Hotel Public Website
        │
        ▼
External Website / Booking Touchpoint
        │
        ▼
HMS Guest Booking Engine / Direct API
        │
        ▼
HMS Reservation + Inventory Engine
```

F&B:

```text
External POS / KDS
        │
        ├── F&B Analytics
        ├── Operational Statistics
        └── Nightly Folio Reconciliation
                     │
                     ▼
                    HMS
```

Do not silently turn HMS into the owner of external POS/KDS.

---

# 25. IMPLEMENTATION ORDER

## Phase 1 — Information Architecture

Build:

- settings shell
- category navigation
- cards
- responsive layout
- configuration status
- permission-aware navigation

## Phase 2 — Domain Configuration

1. Property & Identity
2. Hotel Operations
3. Reservations & Inventory
4. Rooms & Housekeeping

## Phase 3 — Financial Configuration

5. Rates, Taxes & Billing
6. Payments & Night Audit

## Phase 4 — Connectivity

7. Channels & Booking Engine
8. Guest Experience & Communications
9. Integrations & Webhooks

## Phase 5 — Security

10. Security & Access

## Phase 6 — Multi-Property

11. Organization & Multi-Property

---

# 26. IMPLEMENTATION CONSTRAINTS

The coding agent MUST:

- Preserve the existing HMS shell.
- Preserve the existing HMS visual language.
- Preserve working routes outside Settings.
- Use the existing React/TypeScript/Vite/Tailwind architecture.
- Use controlled forms.
- Use validation.
- Use reusable configuration components.
- Keep configuration data typed.
- Avoid hardcoded fake persistence.
- Avoid browser `alert()` for application feedback.
- Add loading/error/success states.
- Respect RBAC.
- Audit sensitive configuration changes.
- Avoid duplicating operational modules.
- Avoid creating HMS-native POS/KDS ownership.
- Avoid unrelated redesigns.
- Avoid premature architecture changes.
- Keep implementation consistent with HMS specification files 00–14.

---

# 27. ACCEPTANCE CRITERIA

- [ ] All 11 categories exist.
- [ ] Categories are permission-aware.
- [ ] Settings do not duplicate operational screens.
- [ ] Property configuration is editable.
- [ ] Operational policies are editable.
- [ ] Reservation/inventory policies are editable.
- [ ] Room/housekeeping policies are editable.
- [ ] Tax rules are configurable.
- [ ] Billing/folio behavior is configurable.
- [ ] Payment methods/deposit/refund policies are configurable.
- [ ] Night Audit policies are configurable.
- [ ] Booking Engine settings are configurable.
- [ ] Channel adapters have focused configuration interfaces.
- [ ] Communication providers and templates are configurable.
- [ ] Security/approval policies are configurable.
- [ ] Integrations/webhooks have configuration/status interfaces.
- [ ] Multi-property configuration is permission-restricted.
- [ ] Sensitive credentials are masked.
- [ ] Save/revert behavior works.
- [ ] Validation works.
- [ ] Loading/error/success states work.
- [ ] Sensitive changes generate audit events.
- [ ] No browser `alert()` is used.
- [ ] No obsolete POS/KDS ownership is introduced.
- [ ] No unrelated HMS screens are redesigned.
- [ ] Responsive layout works on desktop/tablet/mobile.
- [ ] Typecheck passes.
- [ ] Production build passes.

---

# 28. CODING-AGENT IMPLEMENTATION BRIEF

> Redesign `/app/settings` as the centralized HMS Configuration Control Plane using this specification.
>
> Use the supplied TapMenu settings screenshots only as UX/information-architecture inspiration. Do not copy TapMenu's restaurant/POS-specific settings, feature modules, restaurant hours, thermal printers, KDS controls, loyalty, menu configuration, or other restaurant-specific functionality.
>
> The actual configuration scope must come from the HMS specifications and current HMS product boundary.
>
> Implement the 11 Settings categories defined in this document.
>
> Do not create duplicate operational modules. Settings must configure existing HMS domains rather than recreate their operational screens.
>
> Replace static/defaultValue configuration fields with controlled forms, validation, permission checks, save/revert behavior, loading states, success/error states and audit behavior for sensitive changes.
>
> Preserve the existing HMS shell, visual language, routing and working functionality outside Settings.
>
> Respect the current product boundary: the hotel public website is external, HMS owns the Guest Booking Engine/Direct API, and restaurant POS/KDS are external systems whose analytics, operational statistics and nightly folio reconciliation are consumed by HMS.
>
> Do not introduce unrelated redesigns, premature architecture changes, or new operational modules.
>
> After implementation, run typecheck/build and report:
>
> - files changed
> - settings categories implemented
> - controls implemented
> - permissions used/added
> - validation added
> - audit behavior added
> - remaining TODOs
> - typecheck result
> - build result
