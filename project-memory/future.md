# FUTURE — What's Left & What to Build

> The roadmap / backlog. The client wants to **complete the project** (billing is already done
> and approved). This file holds: (A) the client's requested developments, (B) gaps I found,
> (C) tech-debt cleanup. Update (A) as the user describes each new requirement.

---

## A. Client-requested developments (fill in as we go)

> The user will describe the developments to make. Capture each here with: goal, scope,
> decisions made, files touched, and status. Keep newest at top.

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

1. **🔴 Security — Firestore/Storage rules are NOT in the repo.** No `firestore.rules` /
   `storage.rules` / `firebase.json`. Confirm rules exist in the Firebase console and are
   restrictive; ideally version-control them. Without rules, the DB may be world-readable/writable.
2. **🔴 Security — secrets & hardcoded admin.** Firebase config + API key are committed in
   `src/lib/firebase.ts`. `createAdminUser()` creates `swetha@gmail.com` with a trivial password,
   and that email is hardcoded to admin in `AuthContext`. Review before launch.
3. **🟠 Legacy/duplicate files** (see past.md §3) — `*_backup`, `*_broken`, `*_fixed`, `*_New`,
   `Billing_New`, throwaway root `test-*.js`/`debug-*.js`. Remove once confirmed dead (check `App.tsx` imports first).
4. **🟠 Doc sprawl** — 90+ root `*_FIX.md` logs. Consider moving to `docs/archive/` so the root
   is clean and this `project-memory/` folder is the canonical knowledge base.
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
