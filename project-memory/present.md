# PRESENT — Current State of the System

> Snapshot of how the app is built and what exists RIGHT NOW.
> Last verified: 2026-06-26.

---

## 1. Tech stack

| Layer | Choice |
|---|---|
| Build tool | **Vite 5** + `@vitejs/plugin-react-swc` |
| Language | **TypeScript 5.5**, React **18.3** |
| Routing | `react-router-dom` v6 |
| UI kit | **shadcn/ui** (Radix primitives) + **Tailwind CSS 3** |
| Icons | `lucide-react` |
| State/data | `@tanstack/react-query` (present), heavy direct Firestore reads, custom hooks |
| Forms | `react-hook-form` + `zod` |
| Backend | **Firebase** — Auth (email/password), **Firestore** (primary DB), Storage (configured, lightly used) |
| File/media | **Cloudinary** (unsigned upload) for payment screenshots |
| PDF/invoice | `jspdf` + `html2canvas` (client-side), `qrcode` for UPI QR, `jsbarcode`/`html5-qrcode` for barcodes |
| Charts | `recharts` |
| Excel export | `xlsx` |
| Canvas/design | `fabric` (design canvas for order design images) |
| Hosting | **Vercel** (SPA rewrite to `/` in `vercel.json`) |

Scripts: `npm run dev`, `npm run build`, `npm run lint`, plus `diagnose-bills` / `migrate-bills` Node scripts.

## 2. Auth & roles

- `src/contexts/AuthContext.tsx` — Firebase email/password auth. On login, loads a `users/{uid}`
  Firestore doc holding `{ role: 'admin' | 'staff', name, phone }`.
- Two roles: **admin** (full access) and **staff** (limited).
- `src/components/ProtectedRoute.tsx` gates routes with `adminOnly` / `staffOnly`. Non-admins
  hitting an admin route are bounced to `/staff/dashboard` and vice-versa.
- ⚠️ **Bootstrap quirk:** if a logged-in user has no `users` doc, one is auto-created; email
  `swetha@gmail.com` is hardcoded to become `admin`. There is a `createAdminUser()` that creates
  `swetha@gmail.com` with a trivial password. **This is a security weak point** (see future.md).

## 3. Routing / page map (`src/App.tsx`)

Public:
- `/` → `Index` (landing) · `/login` → `Login` · `/view-bill/:token` → `PublicBillView` (no auth — share link)

Admin (role=admin):
- `/dashboard` → `DashboardRouter` → `AdminDashboard`
- `/orders`, `/customers`, `/billing`, `/billing/new`, `/billing/new/:orderId`, `/billing/:billId`,
  `/billing/:billId/edit`, `/inventory`, `/staff`, `/appointments`, `/alterations`, `/reports`,
  `/settings`, `/expenses`, `/admin/expenses`, `/income-expenses`, `/roi-analytics`
- Admin data-repair tools: `/date-format-fixer`, `/billing-migration`, `/duplicate-bill-fixer`

Staff (role=staff):
- `/staff/dashboard`, `/staff/orders`, `/staff/alterations`, (`/staff/inventory` view component exists)

Sidebar nav is defined in `src/components/Layout.tsx` (`adminMenuItems` / `staffMenuItems`).

## 4. Firestore data model (collections actually referenced in code)

Core:
- **users** — auth profile + role
- **customers** — customer records (name, phone, email, address, history)
- **orders** — custom stitching orders (made-for, category, measurements/sizes, design images, assigned staff, required materials, status, dates)
- **bills** — invoices (THE mature feature). Schema = `Bill` interface in `billingUtils.ts`.
- **inventory** — materials/fabrics; plus **inventoryCategories**, **inventoryTypes**
- **staff** — staff members; with `billingRate` (charged to customer) and `costRate` (cost to business)
- **attendance** — staff attendance (feeds salary/expense calc)

Finance:
- **income**, **expenses** — manual income/expense entries
- **billing** — ⚠️ a SEPARATE/older collection still read by Income&Expenses + ROI code alongside
  `bills`. Looks like a legacy duplicate of bills. Needs clarification/consolidation.
- **categories** — income/expense categories

Catalog / helpers:
- **products**, **descriptions** — reusable product + description library for bills (`ProductDescriptionManager`)
- **workDescriptions**, **customItemTypes** — reusable work/item presets
- **roles**, **departments** — staff org structure

Operations:
- **appointments**, **alterations**, **tasks**

> The presence of both `bills` and `billing` collections (and `income`/`expenses` overlapping
> with bill-derived income) is the biggest data-model ambiguity. Confirm source-of-truth before
> building finance features.

## 5. Feature status (current best understanding)

| Feature | State |
|---|---|
| **Billing / invoicing** | ✅ Mature, client-approved. Sequential IDs, products+descriptions, GST, discount, partial payments/payment records, cash/online split, UPI QR, bank details, PDF download, print, WhatsApp share, public share link, payment screenshot upload. **Dashboard list (2026-06-26):** Career/This Month/Today quick toggle (default This Month), 10-at-a-time pagination (Load 10 more / Load all), sessionStorage-persisted filters, client-side date filtering. Product/sub-item dropdowns support keyboard arrow nav. |
| Customers | ✅ Working — list/grid, filters, auto-suggest, profile panel w/ order+bill history |
| Orders | ✅ Working — create/edit, multi-item, design images (fabric canvas), staff assignment, materials, calendar/grid/list views |
| Inventory | ✅ Working — CRUD, categories/types, stats, low-stock, order sync |
| Staff | ✅ Working — staff CRUD, roles/departments, attendance, salary, role analytics |
| Income & Expenses | ⚠️ Works but data-model overlap (`bills` vs `billing` vs `income`/`expenses`); reconcile. **(2026-06-26):** Career/This Month/Today quick toggle (default This Month, shared `QuickRangeToggle`), date-filter labels removed, category dropdown keyboard nav, fixed-height scroll on Tracking category lists. **Accounts tab** (4th tab, for CA): include/exclude income & expense categories, Total Billing, multi-sheet Excel export (`AccountsTab.tsx` + `utils/financeReports.ts`); `dateRange` is memoised so tabs don't refetch every render. **(2026-06-30) Finance figures now consistent app-wide:** all I&E/Accounts/Tracking/tab totals use client-side date filtering (`utils/financeReports.ts` `isInRange`/`getFinancialSummary`), so they match the Billing dashboard exactly (verified ₹4,08,863 across all This-Month income views). Summary "Total Expenses" now uses the inventory+custom+salary model (COGS dropped) to match the CA export. |
| ROI / Analytics | ✅ Reworked (2026-06-30). `/roi-analytics`: Career/This Month/Today toggle (default This Month) + Clear all, client-side date filtering. **Staff ROI & Inventory ROI tabs removed** (they read the obsolete `items[].type` bill format → always 0). Tabs = Overview / Services / Products. Services = bill sub-item descriptions, Products = bill product names. Each card has **Rename / Merge / Delete + Add** (catalog management) — rename/merge rewrite historical bills+orders via `utils/catalogManagement.ts` + `components/roi/CatalogManageDialog.tsx` (with affected-count preview). Billing inputs now canonicalise case-insensitively so casing-duplicates can't be created. `roiCalculations.ts` is dead code. |
| Appointments | 🔶 Exists; completeness not fully verified |
| Alterations | 🔶 Exists (admin + staff views); completeness not fully verified |
| Reports | 🔶 Exists; pulls all collections + charts/export; depth not fully verified |
| Staff dashboard/portal | 🔶 Exists; needs verification of full staff workflow |
| Settings / Business settings | ✅ Business name/contact/logo drive invoice branding (`BusinessSettingsProvider`, `settingsUtils`) |

Legend: ✅ working · ⚠️ working but has known debt/ambiguity · 🔶 present, needs completeness review

## 6. Key files to know

- `src/utils/billingUtils.ts` (~1400 lines) — bill types, ID generation, totals, PDF/print HTML, UPI/QR, WhatsApp templates. **Central to the app.**
- `src/lib/firebase.ts` — Firebase init (⚠️ config/keys hardcoded & committed).
- `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx` — auth/roles.
- `src/components/Layout.tsx` — shell, sidebar nav, theme toggle.
- `src/components/BusinessSettingsProvider.tsx` + `src/utils/settingsUtils.ts` — dynamic company branding.
- `src/contexts/ThemeContext.tsx` — light/dark mode (recent focus area).
- Data-repair utils: `fixDateFormats.ts`, `fixDuplicateBills.ts`, `billMigration.ts`.

## 7. Environment / config required

- `.env` with `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`
  (else payment-screenshot upload fails). See `.env.example`.
- Firebase project: `swetha-couture` (config currently inlined in `src/lib/firebase.ts`).
