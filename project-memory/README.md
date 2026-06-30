# Project Memory — Swetha's Couture

This folder is the **canonical knowledge base** for this project. Read it instead of relying on
chat history. Keep it updated at the end of each work session.

| File | Purpose |
|---|---|
| [past.md](./past.md) | History, origin story, hard-won lessons, legacy/duplicate-file warnings |
| [present.md](./present.md) | Current architecture, tech stack, data model, feature status — "how it works today" |
| [future.md](./future.md) | Backlog: client requests (§A), gaps to finish (§B), tech debt (§C), guardrails (§D) |

## TL;DR
- Tailoring/couture business management app: customers, orders, **billing (mature & client-approved)**,
  inventory, staff, finance, appointments, alterations, reports.
- Stack: Vite + React + TypeScript + shadcn/ui + Tailwind, backed by **Firebase (Firestore)** +
  **Cloudinary**, deployed on **Vercel**.
- Client wants to **complete the remaining features**. Billing is done — touch it carefully.

## Maintenance rule
After finishing any task: log it in `future.md §A`, update `present.md` to reflect the new
reality, and add a lesson to `past.md` if something non-obvious was learned.
