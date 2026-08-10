# FUTURE — What's Left & What to Build

> The roadmap / backlog. The client wants to **complete the project** (billing is already done
> and approved). This file holds: (A) the client's requested developments, (B) gaps I found,
> (C) tech-debt cleanup. Update (A) as the user describes each new requirement.

---

## A. Client-requested developments (fill in as we go)

> The user will describe the developments to make. Capture each here with: goal, scope,
> decisions made, files touched, and status. Keep newest at top.

### Fingerprint device → our own endpoint (ZKTeco K40 Pro) — status: WORKING on LAN; needs a plain-HTTP front door for production (2026-08-10)
- **Goal:** every thumb press lands in our own Firestore within seconds, viewable from anywhere,
  with no dependence on the reseller's ZKBio Time Cloud tenant.
- **Final shape: one endpoint on Vercel.** `api/iclock/cdata.ts` + `api/_deviceIngest.ts`, with
  `vercel.json` rewriting the device's three fixed `/iclock/*` paths onto it.
- **A standalone VPS ingest service was built first and then deleted (2026-08-10) at the client's
  request** — they wanted one implementation, not two. If the Vercel path fails on TLS (see risk
  below), what is needed is a *small plain-HTTP relay* forwarding to Vercel, not that whole
  service back: `api/_deviceIngest.ts` is host-agnostic by design and can be mounted anywhere.
- **Also considered and rejected:** a local agent polling the device on TCP 4370. Its selling
  point is "no always-on server", but a Pi/office PC running 24/7 *is* an always-on server, one
  nobody administers, and it needs the same Firebase credential. ~30s latency for no saving.
- **Built:** `api/_deviceIngest.ts` (all protocol + ingest logic, import-free so it runs in three
  hosts), `api/_firebaseAdmin.ts`, `api/iclock/cdata.ts`, `iclockDevApi` plugin in
  `vite.config.ts` (LAN testing), `scripts/simulate-device.ts`, `firestore.rules`,
  `src/utils/attendance/deviceStore.ts`, `PunchesTab.tsx` + `DeviceHealthBar.tsx`, 4th tab on
  `/attendance`, two rows in `backupSchema.ts`, `docs/BIOMETRIC_DEVICE.md`.
- **Verified:** `npm run test:device` 54/54; `npm run build` clean; all three tsconfig surfaces
  typecheck with zero new errors (8 pre-existing in `ROIDashboard_backup.tsx` / `Dashboard.tsx`,
  confirmed identical on a clean tree); `firebase-admin` confirmed absent from `dist/`.
- **VERIFIED ON THE REAL HARDWARE (2026-08-10).** With `npm run device:receiver` on the office
  LAN and the device on plain HTTP, 20 punches arrived and folded into a correct day record
  (in 17:47, out 18:53, 1.1h). Device serial `GED7261700069`, pre-registered as approved.
- **🔴 The device CANNOT reach Vercel, and this is proven, not suspected.** A TLS probe on the
  LAN presented a self-signed certificate: the terminal connected **55 times and failed all 55**,
  resetting the connection immediately after receiving the certificate. So it *does* enforce
  certificate validation. Its ClientHello offers TLS 1.2 and 80 ciphers, so the TLS version is
  not the problem. Vercel's certificate is issued by Google Trust Services (root created 2016);
  the reseller's, which works, is issued by Amazon (roots from 2009); the device's firmware trust
  store is from `22.5.10-20170306`. Raw evidence kept in `docs/device-tls-evidence.log`.
  **Vercel only ever issues Google-signed certificates, so this cannot be fixed on Vercel.**
- **The fix is a plain-HTTP front door**, because then no certificate is presented at all.
  Recommended: a domain on Cloudflare (free) with `Always Use HTTPS` OFF and SSL mode
  Full (strict), proxying to Vercel. Full click-by-click steps in `docs/BIOMETRIC_DEVICE.md`.
  Interim: `npm run device:receiver` on an office PC — works today, device buffers punches while
  the PC is off and replays them on reconnect.
- **Blocked on the user:** buying a domain, then the Cloudflare setup.
- **BioTime removed entirely 2026-08-10** at the client's request. Rollback to the reseller is now
  a device menu change only (put the old Server Address back); there is no code path left.
- **Follow-ups:** (a) confirm the public bill share link still works after deploying
  `firestore.rules` (catch-all deny); (b) `hoursBetween` is deliberately duplicated in
  `api/_deviceIngest.ts` and `src/utils/attendance/{salaryCalc,punchFolding}.ts` — the api/ one
  must stay import-free to run in three hosts. Change them together.

### ROI Analytics overhaul + catalog management + dedup — status: DONE (2026-06-30)
Big batch. Verified in-browser (desktop + mobile, 0 console errors); the bill-rewrite was proven with a self-reverting rename round-trip ("dresses"→temp→back, 23 bills rewritten each way).
- **Toggle + Clear all + client-side dates:** `/roi-analytics` now has the Career/This Month/Today `QuickRangeToggle` (default This Month, was a weird last-month→this-month window) + a **Clear all** button + custom From/To pickers. Services/Products calcs now use `isInRange` client-side filtering (same as the rest of the app) instead of server-side `where(date)` queries.
- **Staff ROI & Inventory ROI tabs removed.** They were structurally broken: they read the *old* `bill.items[].type==='staff'/'inventory'` format, which current billing (products/descriptions) never writes, so they were always 0. Per the client, hidden. Metrics + Overview reworked to the working data (Total Revenue = `getTotalBilling`, # Services, # Products, Top Product; Overview = top services/products lists). The old `roiCalculations.ts` was already dead code (untouched).
- **What "Services"/"Products" are:** Services = unique bill **sub-item descriptions** (`products[].descriptions[].description`); Products = unique bill **product names** (`products[].name`). Both are derived from bills, grouped case-sensitively — which is why duplicates show as separate cards.
- **Catalog CRUD + MERGE (the big one):** each Service/Product card has **Rename / Merge / Delete**, plus **Add**. Built `src/utils/catalogManagement.ts` (`renameCatalogEntry` = rename or merge, `createCatalogEntry`, `deleteCatalogEntry`, `countUsage`) + `src/components/roi/CatalogManageDialog.tsx`. Rename/merge **rewrite the name inside historical bills AND orders** (amounts never change) via batched `writeBatch` (≤450/commit), and update the master `products`/`descriptions` lists. Each dialog previews "Appears in N bill(s) and M order(s)" before applying. Delete = catalog-list only (warns it won't change bill amounts; use Merge to fold duplicates). **Client approved rewriting historical bills.**
- **Dedup (no more "Stitching"/"stitching"):** the three billing inputs (`ProductNameInput`, `SubItemDescriptionInput`, `CategoryInput`) now **canonicalise on commit** — a typed value that case-insensitively matches an existing option snaps to that option's casing. `ProductDescriptionManager`'s master-list save is now case-insensitive too. So new casing-duplicates can't be created.
- **Files:** new `utils/catalogManagement.ts`, `components/roi/CatalogManageDialog.tsx`; rewrote `components/ROIDashboard.tsx`; dedup edits in `ProductNameInput.tsx`, `SubItemDescriptionInput.tsx`, `CategoryInput.tsx`, `ProductDescriptionManager.tsx`.
- **Part 1 scope note:** Admin Dashboard (revenue from delivered orders, all-time; due-bills no date filter) and `customerCalculations.ts` (per-customer, no date range) have **no mixed-date bug** — nothing to change there. Date-consistency cleanup is now complete for every date-filtered finance surface.
- **NOTE:** the ROI Services/Products cards come from *bills*, so a freshly **Added** catalog entry (not yet used in any bill) won't appear as a card until it's used — it only populates the billing dropdown. Expected.
- **Follow-up fix (2026-06-30):** the Service/Product drill-down modals crashed with `RangeError: Invalid time value` because they used `format(new Date(bill.date…))` directly — once client-side filtering surfaced string/invalid-dated bills, date-fns `format()` threw. Replaced all 4 calls with a `safeFormatDate()` helper (uses `toJsDate`, returns "No date" for unparseable). Verified both modals open with 0 errors.

### Finance date-normalization / consistency cleanup — status: DONE (2026-06-30)
Fixed the long-standing inconsistency where Income & Expenses / Accounts totals undercounted because Firestore **server-side range queries on `date`** silently exclude bills whose date was saved as a *string* (not a Timestamp). Root-cause fix: **all finance date filtering is now client-side** using `toJsDate` normalisation (same approach the Billing page uses), via a new `isInRange(value, dateRange)` helper in `utils/financeReports.ts`. **No data migration** — the app now tolerates any date format (Timestamp / `{seconds}` / string / Date) forever.
- **Verified consistency (This Month):** Billing "Total Revenue" = I&E summary "Total Income" = Income-tab total = Accounts "Income (selected)" = **₹4,08,863** (was ₹2.06L before the fix). 0 console errors.
- **Unified the summary onto the shared util:** `IncomeExpenses.fetchFinancialData` now calls `getFinancialSummary(dateRange)` (sum of `getCategoryData` income/expense). This removed ~200 lines of bespoke logic and made the headline cards match Tracking/Accounts/tab totals exactly.
- **Behaviour change to flag:** the summary "Total Expenses" **no longer uses the COGS model** (cost-of-goods from bill items). It now equals inventory purchases + custom expenses + staff salaries — the same model the Accounts/CA export uses. Net effect is usually nil because bills rarely carry item `cost` (COGS≈0), but it's a definitional change worth knowing.
- **Salary calc unified:** `financeReports` now uses `calculateMonthlySalary` (paidSalary+bonus model) — previously only the summary/ExpensesTab used it while Tracking/Accounts used `salaryAmount`. Now all agree.
- **Files touched:** `utils/financeReports.ts` (rewrite: client-side filtering + `isInRange` + `getFinancialSummary` + `calculateMonthlySalary`), `pages/IncomeExpenses.tsx` (fetchFinancialData simplified), `components/income-expenses/IncomeTab.tsx` + `ExpensesTab.tsx` (list fetches client-filtered). `CategoryBreakdown`/`AccountsTab` already use the util.
- This resolves §C.5's date-consistency item **for the Income & Expenses surface**. ROI Analytics / Admin Dashboard / customer totals still use their own server-side date queries — align them next if the same consistency is wanted there.

### Accounts / CA-export tab — status: DONE (2026-06-26)
New **4th tab "Accounts"** on `/income-expenses`, built for handing figures to a CA. Verified in-browser (desktop + mobile, 0 console errors, real `.xlsx` parsed in the test).
- **What it shows:** Total Billing (gross), Income (selected), Expenses (selected), Net Profit — for the active period (default This Month; the quick toggle + custom date filters drive it).
- **Full control:** every income & expense **category has an include/exclude checkbox** (Select all / Clear all per side). Excluded categories drop out of the totals *and* the export. Verified: clearing all income → Income & Net become ₹0.
- **Export to Excel** (`xlsx` + `file-saver`): 5 sheets — Summary, Income, Expenses, Income Details, Expense Details. Amounts are raw numbers (CA-summable). Filename `Accounts_<Period>_<YYYY-MM-DD>.xlsx`. Verified file: 24KB, all 5 sheets, Summary Total Billing/Income/Net match the UI, 14 income detail rows.
- **New files:** `src/utils/financeReports.ts` (shared `getCategoryData`, `getTotalBilling`, `toJsDate`) and `src/components/income-expenses/AccountsTab.tsx`.
- **Consistency refactor:** `CategoryBreakdown` now also uses `getCategoryData`, so the Tracking tab and the Accounts export always agree.
- **Perf fix (important):** `IncomeExpenses` now **memoises `dateRange`** (`useMemo`) instead of calling `getDateRange()` inline. Previously a new object every render made every tab refetch on each parent re-render — it caused the Accounts tab to flicker back to "Loading". All tabs now refetch only when the period actually changes.
- **Same date-type nuance applies:** Accounts totals use the same Firestore server-side `date`-range queries (string-dated bills excluded) — see the I&E note below and §C.5.

### Income & Expenses UX batch #2 — status: DONE (2026-06-26)
Four fixes to `/income-expenses`, verified in-browser (desktop + mobile, 0 console errors):
1. **Quick date toggle** — Career / This Month / Today on the Date Filters card, defaults to **This Month**. Folded into `getDateRange()` (custom single/range pickers still override the toggle). Verified scoping: This Month income ₹2.06L, Career ₹6.78M (≈ all-time), Today ₹0.
2. **Removed redundant date labels** — dropped the "Single Date / Start Date / End Date" `<Label>`s (placeholders already say it); date row is now a responsive 4-col grid (stacks on mobile).
3. **Category dropdown keyboard nav** — `CategoryInput` (shared by Income + Expense add forms) gained ArrowUp/Down/Enter/Escape + highlight + scroll-into-view (same pattern as the product dropdowns).
4. **Fixed-height scroll** — in the Tracking tab, the inline `CategoryBreakdown` grid is now `max-h-[360px] overflow-y-auto`, and its duplicate inner title was replaced with a compact "Total" bar.

**Component refactor:** generalised `BillingQuickRangeToggle` → **`src/components/QuickRangeToggle.tsx`** (now used by both Billing and Income&Expenses); updated Billing's import/usage and deleted the old file.
**Files touched:** `src/pages/IncomeExpenses.tsx`, `src/components/CategoryInput.tsx`, `src/components/income-expenses/CategoryBreakdown.tsx`, `src/components/QuickRangeToggle.tsx` (renamed), `src/pages/Billing.tsx` (import only).
**Known nuance (pre-existing, NOT introduced):** the IE page totals come from Firestore **server-side range queries on the `date` field**, so bills whose `date` was saved as a string (not a Timestamp) are excluded — that's why IE's "This Month" (₹2.06L) is lower than the Billing dashboard's client-side "This Month" (₹4.02L). Tracks back to the long-standing mixed date-format issue (see §C.5). Candidate for the data-normalisation cleanup.

### Billing dashboard UX batch #1 — status: DONE (2026-06-26)
Five fixes to `/billing` and `/billing/new`, verified in-browser (desktop + mobile, 0 console errors):
1. **Quick date toggle** — new segmented control **Career / This Month / Today**, defaults to **This Month**. "This Month" = current calendar month (the old "Month" select meant *last 30 days*). New component `src/components/BillingQuickRangeToggle.tsx`.
2. **Pagination** — bills list renders **10 at a time** with **"Load 10 more"** and **"Load all (N)"**. Realtime `onSnapshot` still loads the full set; pagination + the default This-Month filter make the page open fast. (`visibleCount` state, `PAGE_SIZE = 10`.)
3. **Filter widths** — `BillingFilters` switched to a 12-col grid: Search (3) / Payment Status (3) / **Custom Date Filter (6, widest)**, so the three calendars have room. Also de-nested the inner `<Card>`.
4. **Sticky filters** — root cause was the From/To filter running a *separate Firestore query that replaced the bills array*, plus no persistence. Fixed by making **all** date filtering client-side (derived from `bills`) and **persisting filter state in sessionStorage** (`billing.filters.v1`), restored via lazy `useState` initialisers. Filters now survive opening a bill and going back.
5. **Keyboard nav** — `ProductNameInput` & `SubItemDescriptionInput` had no arrow-key support (Enter/Escape only). Added `highlightedIndex` + ArrowUp/Down/Enter/Escape, scroll-into-view, and hover sync.

6. **Stat cards follow the toggle (follow-up)** — the four cards (Total Bills, Total Revenue, Paid Bills, Pending Amount) now compute from `dateScopedBills` (bills within the active period), not all-time. Each card shows a coloured period pill (`periodLabel`: Career / This Month / Today / Selected dates). `dateScopedBills` is the single source for both the cards and `filteredBills` (which adds search + status on top). Verified: This Month→18, Career→306, Today→0, pills update live.

**Files touched:** `src/pages/Billing.tsx`, `src/components/BillingFilters.tsx`, `src/components/BillingQuickRangeToggle.tsx` (new), `src/components/ProductNameInput.tsx`, `src/components/SubItemDescriptionInput.tsx`. Removed an unused `useRealTimeData` import from Billing.tsx.
**Notes:** custom date filter overrides the quick toggle (toggle shows muted when a custom date is active). Stats cards remain all-time by design. Verified with Playwright (`tsc` clean for these files; `npm run build` passes).

<!-- TEMPLATE for each new task:
### [TASK NAME] — status: planned | in-progress | done
- **Goal:** what the client wants and why
- **Scope / acceptance:** what "done" looks like
- **Decisions:** key choices, trade-offs, anything the user clarified
- **Files / collections touched:**
- **Notes / follow-ups:**
-->

## B. Gaps to finish (found during code review — confirm priority with client)

These are features that exist but look unfinished or unverified (see present.md §5):

1. **Appointments** — verify full booking flow (create, edit, reminders, calendar, status).
2. **Alterations** — verify end-to-end (intake → assign → status → billing link).
3. **Reports** — confirm the reports the client actually needs; current page is generic.
4. **Staff portal** — verify the complete staff-side workflow (orders, alterations, attendance/check-in, inventory view).
5. **Income & Expenses reconciliation** — decide the single source of truth among
   `bills` vs `billing` vs `income`/`expenses`; ROI accuracy depends on this.

## C. Tech-debt & hardening (do alongside feature work, not as a big-bang refactor)

> Don't mass-delete or refactor without asking — billing is in production and the client is happy.

1. **🟠 Security — Firestore rules.** _Partially resolved (2026-08-08):_ `firestore.rules` is now
   in the repo, covering every collection with an explicit catch-all deny. **Not yet deployed** —
   before publishing, confirm the public bill share link (`/view-bill/:token`, which reads a bill
   while signed out) still works, or give it its own token-keyed rule. `storage.rules` /
   `firebase.json` are still absent.
2. **🔴 Security — secrets & hardcoded admin.** Firebase config + API key are committed in
   `src/lib/firebase.ts`. `createAdminUser()` creates `swetha@gmail.com` with a trivial password,
   and that email is hardcoded to admin in `AuthContext`. Review before launch.
3. **🟠 Legacy/duplicate files** (see past.md §3) — `*_backup`, `*_broken`, `*_fixed`, `*_New`,
   `Billing_New`, throwaway root `test-*.js`/`debug-*.js`. Remove once confirmed dead (check `App.tsx` imports first).
4. **✅ Doc sprawl — RESOLVED (2026-08-10).** The 89 root `*_FIX.md` / `*_IMPLEMENTATION.md`
   logs now live in `docs/archive/<topic>/` (billing, payments, whatsapp, finance,
   pdf-invoices, products, orders, staff, cloudinary, ui-components, general) with an index at
   `docs/archive/README.md`. 17 of them are 0 bytes and can be deleted whenever. The 11 empty
   root `test-*.js` / `debug-*.js` throwaways were deleted outright — they contained nothing
   and were referenced by nothing. Root now holds only `README.md`, which points here.
5. **🟡 Data consistency** — date formats and duplicate bills needed repair tools; consider
   normalizing on write so the `/date-format-fixer` and `/duplicate-bill-fixer` tools become unnecessary.
   _Partially resolved (2026-06-30):_ the **Income & Expenses surface** no longer depends on date format
   (client-side filtering via `financeReports.isInRange`). ROI Analytics, Admin Dashboard and
   customer-total calcs still use server-side `date` range queries — same fix can be applied there.
6. **🟡 No automated tests.** Only ad-hoc manual test scripts exist. Add at least smoke tests for
   billing math (`calculateBillTotals`, `generateBillId`) before refactoring them.
7. **🟡 Performance** — many pages do `getDocs` on whole collections client-side. Will not scale;
   add query limits/pagination/indexes as data grows.

## D. Working agreements / guardrails (how to work on THIS project)

- **Billing is production & client-approved.** Touch it carefully; verify which file is live in
  `App.tsx` before editing (duplicates exist).
- Bills have **two shapes** (`items` legacy + `products` new) — keep both rendering paths working.
- **Bill ID generation** and **date handling** are fragile and were fixed many times — change with tests.
- Prefer **incremental, verified changes** over large refactors.
- **Keep this `project-memory/` folder updated** at the end of each work session: log what changed
  in `future.md` §A and reflect new reality into `present.md`.

---

### How to use this folder
- **past.md** = history & lessons (why things are the way they are)
- **present.md** = current architecture & feature status (source of truth for "how it works today")
- **future.md** = backlog: client requests (A), gaps (B), tech debt (C), guardrails (D)

When a task is finished: move it from future §A → reflect into present.md, and note the lesson in past.md if relevant.
