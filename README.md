# Swetha's Couture — Business Management System

**Developed by:** Dream Team Services · **Client:** Swetha's Couture

Customers, orders, billing, inventory, staff, finance, appointments, alterations, reports,
and fingerprint attendance.

## Where the documentation lives

| Read this | For |
|---|---|
| **[`project-memory/`](./project-memory/)** | **Start here.** How the system works today, what's been built, what's left |
| [`docs/BIOMETRIC_DEVICE.md`](./docs/BIOMETRIC_DEVICE.md) | Fingerprint terminal — setup, troubleshooting, why it needs plain HTTP |
| [`docs/DATA_SAFETY.md`](./docs/DATA_SAFETY.md) | Backup and restore |
| [`docs/archive/`](./docs/archive/) | Historical build notes, kept for reference only |

`project-memory/` is the canonical knowledge base — three files covering the past
(lessons and traps), the present (architecture and data model) and the future (backlog).
Anything in `docs/archive/` is a snapshot of one past change and may describe code that has
since been rewritten.

## Running it

```sh
npm install
npm run dev          # http://localhost:8080
```

Copy [`.env.example`](./.env.example) to `.env` and fill it in first — the app refuses to
start without the Firebase config, by design.

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint |
| `npm run test:device` | Fingerprint device simulator (54 checks, no hardware needed) |
| `npm run device:receiver` | Plain-HTTP receiver for the fingerprint terminal on the office LAN |

## Stack

Vite · React · TypeScript · shadcn/ui · Tailwind, on Firebase (Firestore + Auth) and
Cloudinary, deployed to Vercel. Serverless functions live in [`api/`](./api/).

## ⚠️ Before changing anything

**Billing is in production and client-approved.** Read
[`project-memory/future.md`](./project-memory/future.md) §D for the working agreements —
notably that bills exist in two shapes, and that bill-ID generation and date handling are
fragile and have been fixed many times.

Two traps that cost real debugging time:

- Relative imports in [`api/`](./api/) **must** carry a `.js` extension. `package.json`
  declares `"type": "module"`, so Node rejects extensionless imports at load and the
  function dies with an unhelpful 500.
- New Firestore collections must be added to `src/utils/backup/backupSchema.ts`, or they
  are silently missing from every backup.

---

**© 2026 Dream Team Services**
