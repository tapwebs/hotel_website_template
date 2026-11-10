# QR Hub

Multi-organization QR manager for Hotel Dream Heaven's (first organization: `hotel-dream-heavens`). Now part of the main frontend app (`frontend/src/features/qrhub`), served by the same build as the rest of the site. Data, auth and analytics live in the Fastify API (`backend/`, migration `0003_qr_hub.sql`); admin pages reuse the main site's admin session.

## Routes

- `/admin/qr-hub/*` admin (admin role only, noindex)
- `/hub/:slug` public hub (noindex)
- `/r/:slug?p=<placement>` scan entry, handled by the API (logs the visit, 302 to the hub)

## Checks

```
npm ci
npm run typecheck && npm run lint && npm test && npm run build
```

## JSON import / export format (version 1)

```json
{
  "format": "dream-heavens-qr-hub",
  "version": 1,
  "exported_at": "2025-01-01T00:00:00.000Z",
  "organizations": [
    {
      "slug": "hotel-dream-heavens",
      "name": "...",
      "links": [],
      "placements": [],
      "offers": [],
      "qr_urls": []
    }
  ]
}
```

Each organization also carries its profile fields. `qr_urls` lists the exact URL each QR encodes, so the file doubles as a QR export.

- Excluded: analytics, internal ids, and the Wi-Fi password (unless "include Wi-Fi password" is ticked on export).
- Import validates everything first and shows a dry-run preview (create / update / skip per organization, counts, errors). Modes: `skip existing` or `update existing`; matched by slug, links by title, placements by code. Applied in one transaction, all or nothing.
- Limits: 1 MB file, 200 organizations, 500 links and 500 placements per organization.
