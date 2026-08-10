# PRESENT — Current State of the System

> Snapshot of how the app is built and what exists RIGHT NOW.
> Last verified: 2026-08-07.

## 0. 2026-08-07 change set (read this first)

- **Payments are records, not a number.** `paymentRecords` on a bill is the source of truth;
  `paidAmount`/`balance`/`status`/`totalCash|OnlineReceived` are denormalised copies. Always
  write them together via `buildPaymentUpdate()` in `billingUtils.ts`. The billing list's
  Paid / Partial / Unpaid menu now opens `components/BillPaymentDialog.tsx` (a compact
  Payment Tracking panel) instead of overwriting `paidAmount` — that overwrite was the bug
  where a second part-payment replaced the first.
  `getPaymentRecords()` back-fills a synthetic record for legacy bills that only have `paidAmount`.
- **Income = collected, not billed.** `financeReports.getCategoryData('income')` emits one
  entry per payment received, dated when the money arrived. `getFinancialSummary()` also
  returns `uncollected` (billed − collected in the period). The I&E page, its Accounts export
  and the dashboard's Income & Expenses card all read from this one function.
- **Sales.** `Product.isSale` / `ProductDescription.isSale` mark goods sold over the counter;
  ROI Analytics has a Sales tab + card driven by them.
- **Collections.** `customerCalculations` returns `pendingBills` / `oldestPendingDate` /
  `daysPending`. Customers page defaults to a collections view (oldest debt first);
  `CustomerWhatsAppModal` auto-selects a payment-reminder template that mints a public
  share link per pending bill.
- **Admin dashboard** was rebuilt around action: `PendingPaymentsPanel` + `PendingBillsPanel`,
  six action counters. Vanity metrics, Quick Actions and the duplicated Attendance/Analytics/
  ROI tabs were removed (each already has its own sidebar page).
- **Staff → Employees.** Route `/employees` (with `/staff` kept as an alias). The pay form is
  one basis + one amount; the legacy `paidSalary` override is cleared on save so `salaryAmount`
  is authoritative. `utils/attendance/employeeLink.ts` joins `staff` ↔ `attendanceEmployees`
  and computes payable salary from real check-in/check-out.
- **Design Studio** (`components/design/DesignStudio.tsx`) replaces `ToolDesignCanvas`
  (now dead code). Responsive fabric.js canvas. Saves both a Cloudinary PNG and fabric JSON
  (`OrderItem.designJson`) so a design can be reopened and edited.
  **Four non-obvious things keep it working — do not "simplify" them away:**
  1. It is a nested **Radix dialog layer**, not a hand-rolled overlay/portal. It opens from
     inside the order dialog; a modal Radix dialog traps focus to its own subtree, so
     anything outside that subtree loses focus instantly.
  2. Fabric appends its hidden `<textarea>` (the element that receives keystrokes during text
     editing) to `document.body`. `text:editing:entered` **re-parents it into the studio**,
     otherwise the focus trap steals focus and every typed character is swallowed.
  3. `setCoords()` after every shape mutation / `loadFromJSON` / template / clone. Fabric
     caches hit-boxes; without it a drawn shape keeps its initial 1×1 box and can never be
     clicked, selected or erased.
  4. The canvas element is held in **state via a callback ref**, not a `useRef` — Radix mounts
     portal content in a later commit, so an effect keyed on `isOpen` alone finds no `<canvas>`.
- **Backup & Restore** — `/backup` (admin). `utils/backup/` holds the schema (27 collections),
  a lossless Excel engine (`@ts:` / `@json:` / `@null` / `@empty` cell markers, `__id` per row)
  and reminder state in `syncState/backup`. Restores are id-keyed and idempotent, so importing
  into a fresh Firebase project rebuilds the business. `BackupReminderDialog` nags admins until
  the first full export exists, then once per completed month. See `docs/DATA_SAFETY.md`.
- **Config** — Firebase and Cloudinary now read from `VITE_*` env vars; `src/lib/firebase.ts`
  throws at start-up if they are missing. `.env` is gitignored; `.env.example` is the template.
- **Layout** — the main column carries `min-w-0`. Without it any wide child stretched the whole
  shell past the viewport on mobile (this was the cause of the I&E / Attendance / Settings
  horizontal-scroll bugs).

## 0a. 2026-08-08/10 change set — fingerprint device pushes to us directly (read this first)

- **The ZKTeco K40 Pro now pushes punches to our own endpoint** over the **ADMS** protocol,
  instead of us pulling them from the reseller's cloud. Reason: the `itime.minervaiot.com`
  tenant's only working credential is a portal `accessToken` that **expires** and must be
  re-pasted by hand — an attendance feed that dies every few days is not a feed.
- **One handler, three hosts.** All protocol and database logic is in **`api/_deviceIngest.ts`**,
  which is deliberately **import-free and self-contained** — that is what lets the identical code
  run in Vercel (`api/iclock/cdata.ts`), in the Vite dev server (`iclockDevApi` plugin in
  `vite.config.ts`, so the device can be tested over the office LAN before any deploy), and in
  `scripts/simulate-device.ts`. The database is injected as a `DocStore`, so the simulator needs
  no Firebase project at all.
- **`vercel.json` rewrites** `/iclock/cdata`, `/iclock/getrequest`, `/iclock/devicecmd` →
  `/api/iclock/cdata`. ⚠️ **These MUST stay above the `/(.*)` → `/` SPA catch-all** — rewrites
  match top-down, and the catch-all would otherwise serve the React app to the device.
- **`firebase-admin` was added** (`api/_firebaseAdmin.ts`, `getApps().length` guarded) because the
  device cannot authenticate, so writing its punches needs real admin credentials. This differs
  from `api/_auth.ts`, which verifies ID tokens by hand precisely to avoid a service account —
  that works for *checking a caller*, not for *writing on behalf of a device*.
- **New collections:** `devices` (doc id = serial number), `devicePunches`
  (doc id = `${sn}_${pin}_${YYYYMMDDHHmmss}`), `deviceRawLogs` (every request, logged **before**
  parsing, self-deleting via a Firestore TTL policy on `expiresAt`). The first two are in
  `backupSchema.ts`; `deviceRawLogs` is deliberately excluded — short-lived diagnostics, and
  every punch in it is already in `devicePunches`.
- **Dedup is the deterministic doc ID**, the same mechanism `attendanceRecords` already uses. The
  device replays its whole batch after any failed handshake; an already-present ID is simply not
  written again. No unique index, no transaction, no read-modify-write race.
- **Unknown serials are quarantined, not rejected.** A new device is written `status: 'pending'`,
  its punches stored but flagged `parked` and kept out of payroll, and it appears on the
  Attendance page with an **Approve** button. Approving backfills everything it held
  (`deviceStore.approveDevice` → `backfillParkedPunches`). This is why the serial number never
  had to be known before deployment.
- **It feeds the existing module.** `attendanceEmployees` / `attendanceRecords` get the same rules
  as before (check-in = earliest punch, check-out = latest; `manuallyEdited` records keep their
  admin-corrected times). Records and Payroll are unchanged.
- **Non-obvious protocol facts — do not "fix" these:**
  1. The endpoint must answer **exactly `OK`** after ATTLOG. Anything else and the device retries
     forever. `/iclock/getrequest` also returns `OK` when no commands are queued.
  2. **It answers `OK` even when our own processing threw.** Counter-intuitive but correct: the
     body is already in `deviceRawLogs` so nothing is lost, whereas a non-OK reply starts a retry
     loop that stalls every later punch behind the failed batch.
  3. One malformed row is skipped and counted — it never fails the batch, for the same reason.
  4. `Content-Length` and charset are **never trusted**; the body is read as raw bytes and decoded
     UTF-8 with a latin1 fallback.
  5. Timestamps are converted by arithmetic on the parsed parts, not `new Date(string)` — Vercel
     runs in UTC, so that would put every punch 5.5 hours out.
  6. **ATTLOG rows need their own splitter** (`splitAttlogRow`). The generic space fallback tears
     `1003 2026-08-09 10:00:00 0 1` apart at the space *inside the timestamp* and silently drops
     the punch. This was a real bug, fixed 2026-08-08, with a regression test.
- **UI:** fourth tab **Punches** on `/attendance` (raw feed, employee filter, CSV export) and
  `DeviceHealthBar` — the health signal. The device polls every ~30s even with no punches, so
  `lastSeenAt` going quiet is meaningful on its own; stale threshold is
  `VITE_DEVICE_STALE_MINUTES` (default 15). Health states: healthy / waiting-for-first-contact /
  stale / pending-approval / blocked / none.
- **BioTime is GONE (2026-08-10, client's call — "no requirement of that biotime").** Deleted:
  `api/biotime.ts`, `api/_biotimeCore.ts`, `api/_auth.ts`, `src/utils/attendance/biotimeSync.ts`,
  `SyncStatusBar.tsx`, `BiotimeConnectDialog.tsx`, the vite dev plugin, all `BIOTIME_*` env vars,
  the `syncState/biotime` + `syncState/biotimeConnection` docs, and the 2026-08-07 spec.
  `todayKey` and `foldPunchesIntoRecords` survived into **`src/utils/attendance/punchFolding.ts`**
  — they are not BioTime-specific and the device backfill needs them.
  `AttendanceRecord.source` / `AttendanceEmployee.source` are now `'manual' | 'device'`.
- **`firestore.rules` is now in the repo** — previously not version-controlled at all (was §C.1
  🔴). Device collections are admin-read / client-write-denied. ⚠️ Contains a catch-all deny; the
  public bill share link (`/view-bill/:token`) may need its own rule before deploying.
- **Tests:** `npm run test:device` — 54 checks, no framework, no Firebase, no hardware.
- **🔴 THE api/ GOTCHA — read before adding any serverless function.** `package.json` declares
  `"type": "module"`, so Node ESM requires **explicit `.js` extensions on relative imports** in
  `api/`. TypeScript does not add them. An extensionless `import './_foo'` compiles fine, deploys
  fine, and then throws `ERR_MODULE_NOT_FOUND` at module load — surfacing as a bare
  `FUNCTION_INVOCATION_FAILED` 500 with no usable message. **`api/biotime.ts` had this bug from
  the day it was written and had never once worked in production**; it was found and fixed
  2026-08-10 while debugging the device endpoint. Always write `from './_foo.js'`.
- **The other 500 was the private key.** `FIREBASE_PRIVATE_KEY` in Vercel had been pasted as the
  bare base64 body with the `-----BEGIN/-----END` armour lines left behind. OpenSSL reports only
  `DECODER routines::unsupported`. `normalisePrivateKey()` in `api/_firebaseAdmin.ts` now strips
  wrapping quotes, unescapes `\n`, and rebuilds the PEM armour, so all five common paste
  manglings work. Verified against the real key.
- **`api/ping.ts`** is a permanent diagnostic: reports Node version, whether each `FIREBASE_*` var
  is set, and whether each import and the Firestore handle actually build. It exposes no secret
  values. It is how both bugs above were found without Vercel dashboard access — start there next
  time an `api/` route 500s.
- **⚠️ Open risk:** Vercel forces HTTPS and modern TLS; the K40 Pro is a classic-series terminal
  that may only speak plain HTTP. The LAN dev-server path is proven; the live Vercel path is not
  yet confirmed against real hardware. If the device connects on LAN but goes silent against the
  domain, that is the cause and a plain-HTTP relay is needed.
- See `docs/BIOMETRIC_DEVICE.md`.

## 0b. 2026-08-08 change set

- **Performance.** `utils/firestoreCache.ts` is a short-TTL (30s) burst cache that coalesces
  concurrent whole-collection reads; writes call `invalidateCollection`. `financeReports`,
  `ROIDashboard`, both dashboard panels, `Reports` and `customerCalculations` all read through it.
  `enrichCustomersWithStats` was an N+1 — up to four Firestore queries *per customer*, ~500 round
  trips — and is now **two** collection reads indexed in memory. Customers page: 7.5s → ~2.5s.
  The page also paints from the customer snapshot immediately and fills balances in after.
- **`useRealTimeStats`** — `activeOrders` and `pendingOrders` both counted `'received'`, so
  anything summing them double-counted. They are now disjoint (`in-progress` vs `received`).
- **`FilterPanel`** (`components/FilterPanel.tsx`) is the one search-and-filter panel for every
  list page — search always visible, filters collapsed by default with an active-count badge.
  Used by Orders, Inventory (its date filters fold in via the `dateFilters` prop), Alterations,
  Appointments and the Customers collections view.
- **Reports** used to define revenue as "orders marked delivered", reporting ₹0 and a large loss
  while Income & Expenses showed real collected income. It now reads `getFinancialSummary` /
  `getMonthlySeries`, so every finance figure in the app agrees. `getMonthlySeries` buckets a
  year in one pass — twelve `getFinancialSummary` calls left the page stuck on its skeleton.
  Also fixed: horizontal bar charts need `layout="vertical"` in recharts, and the order-status
  pie now uses an explicit legend instead of colliding slice labels.
- **Design Studio eraser** paints in the artboard colour rather than deleting objects. Fabric's
  per-object `globalCompositeOperation` (true pixel subtraction) is **not honoured** by this
  build's render path — verified empirically, do not retry it. "Split outline into parts"
  ungroups a template so pieces can be deleted individually.
- **Backup** now covers **29** collections (`designs` and `userPreferences` were missing) plus a
  `_media` sheet cataloguing every Cloudinary URL, since images live outside Firestore. The
  schema file carries the grep command for re-checking drift.
- Customer profile panel opens on **Bills**, not Orders.

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
| **Attendance & Payroll** | ✅ New (2026-08-07). `/attendance`, admin-only, sidebar "Attendance". Three tabs: Records (per-day check-in/out, admin-editable), Employees (pay basis + amount, auto-created on first fingerprint), Payroll (monthly days/hours → salary, Mark Paid + soft-revert Undo, Excel export). New collections `attendanceEmployees` / `attendanceRecords` / `salaryPayments` / `syncState/biotime` — **separate from `staff` and the legacy `attendance` collection**, deliberately, to avoid double-counting salary. Salary: daily = rate×days, hourly = rate×hours, monthly = salary ÷ working days (Sundays excluded) × days present, capped at full salary. BioTime Cloud punches arrive via server-side proxy `api/biotime.ts` (+ Vite dev middleware in `vite.config.ts`); credentials never enter the browser bundle (verified against `dist/`). **Live refresh:** re-syncs every 60s while the page is visible, paused when the tab is hidden; sync writes only records that actually changed, so polling does not burn Firestore quota. **Auth reality (probed 2026-08-07):** tenant is ZKBio Time Cloud on Minerva IoT (`itime.minervaiot.com`; `dreamteamservices.itime.minervaiot.com` is the *device-facing* address). nginx rejects POST to every login path from outside the browser, so **server-side username/password login is impossible** — the only working credential is the portal session `accessToken` (`Authorization: JWT <token>`), which expires. Hence the **Connect BioTime** dialog: admin pastes portal URL + accessToken, stored in `syncState/biotimeConnection`, sent to the proxy as `x-biotime-*` headers. Env vars `BIOTIME_*` still work as a fallback. See `docs/superpowers/specs/2026-08-07-biometric-attendance-payroll-design.md`. |
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
