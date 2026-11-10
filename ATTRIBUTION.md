# Attribution and Licensing Notice

**TapMenu — Open Hospitality Platform**

This document records the original authorship, open-source dependencies, licensing details, and asset provenance for the public release of the TapMenu Open Hospitality Platform.

---

## 1. Project Authorship and Primary Maintainer

- **Developer & Maintainer**: [TAPWEBS](https://tapwebs.in)
- **Primary Product**: TapMenu Open Hospitality Platform
- **Project Purpose**: An open-source, modular, enterprise-grade hospitality operating platform combining hotel operations (HMS), point-of-sale (POS), kitchen display systems (KDS), in-room QR dining, and direct guest booking.

---

## 2. Asset Provenance & Image Licensing

All commercial property photography, private guest pictures, and client-specific promotional banners originally captured for physical locations have been **100% removed and replaced**.

### Replacement Media Summary:
- **Total Asset Footprint**: ~90 KB (Strictly below the 2.0 MB maximum threshold).
- **Public Website Images (`frontend/website/public/images/`)**: Replaced with clean, valid minimal WebP placeholders conforming to responsive picture formats (640w, 1024w, 1448w, 1600w).
- **Brand Identity & Social OpenGraph Assets**:
  - `frontend/website/public/banner.jpeg` (1200x630): Lightweight generic geometric hotel banner created with Pillow.
  - `frontend/website/public/og-image.jpg` (1200x630): Lightweight generic social preview card created with Pillow.
  - `frontend/website/public/logo.png` (512x512): Generic TapMenu emblem.
  - `frontend/hms/public/logo-badge.webp` & `logo-badge-320.webp`: Lightweight generic application badge assets.
- **License**: All generated and replacement assets are provided under the MIT License for open-source use. Deployers may freely substitute their own property photography.

---

## 3. Open-Source Libraries & Component Attributions

TapMenu integrates open-source libraries under permissive licenses:

### Backend Services
- **FastAPI** (`MIT License`) — Tiangolo & contributors
- **SQLAlchemy** (`MIT License`) — Mike Bayer & contributors
- **Fastify** (`MIT License`) — Fastify team & contributors
- **Pydantic** (`MIT License`) — Samuel Colvin & contributors
- **asyncpg** (`Apache 2.0 License`) — MagicStack Inc.
- **httpx** (`BSD-3-Clause`) — Encode OSS

### Frontend Applications
- **React 19 & React DOM** (`MIT License`) — Meta Platforms, Inc.
- **Vite** (`MIT License`) — Evan You & contributors
- **Tailwind CSS** (`MIT License`) — Tailwind Labs, Inc.
- **Lucide Icons** (`ISC License`) — Lucide Project
- **Zustand** (`MIT License`) — Daishi Kato & contributors
- **TanStack Query** (`MIT License`) — Tanner Linsley & contributors
- **FullCalendar** (`MIT License`) — FullCalendar LLC

---

## 4. Generic Demonstration Data

All operational databases, seed configurations, and mock fixtures are populated exclusively with fictional entities:
- **Demonstration Organization**: TapMenu Hospitality Group
- **Demonstration Properties**: TapMenu Grand Resort & Spa, TapMenu Beach Resort & Villas
- **Demonstration Addresses**: 100 Hospitality Boulevard, Metropolis
- **Contact Details**: `contact@example.com`, `+91 98765 43210`
- **Guest Profiles**: Synthetic sample names generated strictly for system validation.

No real guest personal records, payment transaction details, or production database dumps exist within this repository.

