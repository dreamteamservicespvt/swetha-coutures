# Biometric Attendance & Payroll — Design

**Date:** 2026-08-07
**Status:** Approved for implementation

## 1. Goal

Pull fingerprint punches from the office ZKTeco **BioTime Cloud** device into the app, turn them
into per-day check-in / check-out records, let the admin set each person's pay basis
(monthly / daily / hourly), compute salary from actual attendance, and mark a period paid —
with an undo.

## 2. Decisions taken

| Question | Decision |
|---|---|
| Device link | BioTime Cloud REST API via a server-side proxy |
| Punch trust | Auto-approved; admin can edit any record |
| Monthly pay | Pro-rated by days present |
| Employee identity | New `attendanceEmployees` collection, optional link to existing `staff` |

## 3. Why a server-side proxy

The app is a browser-only React SPA. Calling BioTime Cloud directly from the browser fails on
two counts: the browser blocks cross-origin calls to a host that does not opt in (CORS), and any
credential shipped to the browser is readable by anyone who opens devtools.

So one serverless function, `api/biotime.ts`, holds the credentials and is the only thing that
talks to BioTime. It is deployed by Vercel in production and mounted into the Vite dev server by
a small plugin in development, so the same handler runs in both.

Environment variables (**no `VITE_` prefix** — that prefix is what publishes a variable to the
browser bundle):

```
BIOTIME_BASE_URL      e.g. https://<tenant>.zkbiotimecloud.com
BIOTIME_USERNAME
BIOTIME_PASSWORD
```

If any are unset the proxy returns a `not_configured` status rather than an error, and the UI
shows a "BioTime not connected" banner. Every other part of the feature still works.

## 4. BioTime Cloud API

| Purpose | Call |
|---|---|
| Login | `POST /jwt-api-token-auth/` body `{username, password}` → `{token}` |
| Auth header | `Authorization: JWT <token>` |
| Punches | `GET /iclock/api/transactions/?start_time=&end_time=&page=&page_size=` |
| Employees | `GET /personnel/api/employees/?page=&page_size=` |

Punch record fields used: `id`, `emp_code`, `punch_time`, `punch_state`, `terminal_alias`.
`punch_state` `"0"` = check-in, `"1"` = check-out. Times are `YYYY-MM-DD HH:mm:ss` in the
tenant's local timezone.

The proxy paginates until exhausted and returns a flat array. It caches the JWT in module scope
until expiry to avoid logging in on every request.

### What the live tenant actually does (verified 2026-08-07)

The client's tenant is `https://dreamteamservices.itime.minervaiot.com` — ZKBio Time Cloud on
the Minerva IoT platform. Probing it showed the published BioTime 8.5 manual does **not**
describe this generation:

| Path | Result |
|---|---|
| `GET /iclock/api/transactions/` | **401 JSON** `{"code":"ZBSY0002",…}` — real endpoint, needs auth |
| `GET /iclock/api/terminals/` | **401 JSON** — real endpoint |
| `GET /personnel/api/employees/` | **200 text/html** — SPA shell, not an API here |
| `POST /jwt-api-token-auth/` | **405** from nginx |
| `POST /api/jwt-api-token-auth/` | **405** from nginx |
| `POST /oauth/api/v2/sign_in/` | **405** from nginx |

The tenant's own JS bundle names its endpoints: `USER_LOGIN: "/api/jwt-api-token-auth/"` plus an
`/oauth/api/v2/` family (`sign_in`, `company-list`, `company-token`, `refresh_token`) — a
multi-tenant company-scoped token flow. nginx rejects POST to all of them from outside, so
**password login over the API is not available on this tenant**.

Consequence for the design: the client supports two credential styles. A portal-issued
`BIOTIME_API_TOKEN` skips login entirely and is the path that will work here; username/password
remains for classic on-premise installs. The auth header scheme is configurable
(`BIOTIME_AUTH_SCHEME`, default `JWT`).

Also verified: the tenant has **0 devices and 0 employees registered**. Until the office
fingerprint machine is registered under Device → Device with its serial number, the API has
nothing to return regardless of credentials.

### Field-name tolerance

Field naming drifts across BioTime versions (8.0 / 8.5 / 9.5 / Cloud). Normalisation reads each
value through a small list of candidate keys (`emp_code` ‖ `employee_code` ‖ `employee`,
`punch_time` ‖ `punch_state_time` ‖ `time`) and the transactions path is tried as both
`/iclock/api/transactions/` and the manual's typo'd `/iclock/api/transctions/`. A version bump
should not silently produce zero punches.

## 5. Data model

Three new Firestore collections. Nothing existing is modified.

### `attendanceEmployees` — one doc per unique fingerprint user

Doc ID = `empCode` (the BioTime employee code — stable, unique, device-issued).

```ts
{
  empCode: string;
  name: string;                 // from BioTime; admin-editable
  department?: string;
  salaryMode: 'monthly' | 'daily' | 'hourly' | null;   // null = not configured yet
  salaryAmount: number;         // 0 until admin sets it
  standardHoursPerDay: number;  // default 8
  active: boolean;              // default true
  linkedStaffId?: string;       // optional link to existing `staff` doc
  source: 'biotime' | 'manual';
  firstSeenAt, createdAt, updatedAt: ISO string;
}
```

A person appears here automatically the first time their punch is synced. Until the admin sets
`salaryMode` + `salaryAmount`, they are flagged **Needs setup** and contribute ₹0 to payroll.

### `attendanceRecords` — one doc per employee per day

Doc ID = `` `${empCode}_${date}` `` where `date` is `YYYY-MM-DD`.

```ts
{
  empCode, employeeName, date: string;
  checkIn?: string;             // 'HH:mm'
  checkOut?: string;            // 'HH:mm'
  hoursWorked: number;          // 0 when checkOut missing
  status: 'present' | 'incomplete';   // incomplete = punched in, never out
  punches: string[];            // every raw punch time that day, for audit
  source: 'biotime' | 'manual';
  manuallyEdited: boolean;
  createdAt, updatedAt: ISO string;
}
```

**The deterministic ID is the idempotency mechanism.** Re-syncing an overlapping window rewrites
the same doc instead of creating a duplicate, so sync can run as often as it likes and an
interrupted sync can simply be re-run.

A day with several punches collapses to `checkIn` = earliest, `checkOut` = latest. This is
correct for the common lunch-break case, where naive pairing would drop the afternoon.

**Manual edits are never overwritten.** If `manuallyEdited` is true, sync leaves the record's
times alone and only appends to `punches`. Otherwise an admin correction would silently revert on
the next sync.

### `salaryPayments` — payment marking with undo

Doc ID = `` `${empCode}_${periodKey}` `` where `periodKey` is `YYYY-MM`.

```ts
{
  empCode, employeeName, periodKey, periodStart, periodEnd: string;
  amount: number;               // snapshot at time of payment
  daysWorked: number;
  hoursWorked: number;
  salaryMode: string;           // snapshot — basis may change later
  status: 'paid' | 'reverted';
  paidAt, paidBy: string;
  revertedAt?, revertedBy?: string;
}
```

Undo sets `status: 'reverted'` rather than deleting, so an accidental click and its correction
both stay on the record. The amount is snapshotted so a later salary-rate change does not
retroactively alter what was recorded as paid.

### `syncState/biotime` — single doc

```ts
{ lastSyncedAt, lastRunAt, lastRunStatus, lastError?, punchesImported, employeesCreated }
```

## 6. Sync algorithm

1. Read `syncState/biotime`. Window start = `lastSyncedAt` minus 2 days (re-pull overlap catches
   punches uploaded late by the device); on first run, 60 days back. Window end = now.
2. `GET /api/biotime?action=transactions&start=…&end=…` → flat punch array.
3. Group by `emp_code`, then by calendar date.
4. For each unseen `emp_code`, create an `attendanceEmployees` doc (name from the employees
   endpoint, falling back to the punch payload, then to the code itself).
5. For each employee-day, write the `attendanceRecords` doc (skipping time fields on
   manually-edited records).
6. Write `syncState/biotime`.

Writes go through Firestore `writeBatch` in chunks of 400 (the limit is 500) so a 60-day first
import is a handful of round-trips rather than thousands.

Triggered on page load and by a **Sync now** button. No cron: the shop's admin opens the app far
more often than the 60-day first-run window, and the overlap re-pull covers gaps.

## 7. Salary calculation

Pure functions in `src/utils/attendance/salaryCalc.ts` — no Firestore, no React, directly
testable.

Given an employee, their `attendanceRecords` for a period, and the period bounds:

- `daysWorked` = records with a `checkIn`
- `hoursWorked` = Σ `hoursWorked`
- `workingDaysInMonth` = calendar days in the period **minus Sundays**

| Mode | Formula |
|---|---|
| `daily` | `salaryAmount × daysWorked` |
| `hourly` | `salaryAmount × hoursWorked` |
| `monthly` | `salaryAmount ÷ workingDaysInMonth × daysWorked`, capped at `salaryAmount` |
| `null` | `0`, flagged "Needs setup" |

The monthly cap prevents overtime days (a Sunday shift) from paying more than the agreed monthly
salary. Results round to 2 decimals.

## 8. UI

New admin-only page at `/attendance`, sidebar entry "Attendance" (Fingerprint icon), placed after
Staff. Three tabs:

**Records** — date-range filter using the app's existing `QuickRangeToggle` (Career / This Month /
Today), table of employee · date · check-in · check-out · hours · status. Row edit dialog for
correcting a missed punch. Sync status bar with last-synced time and **Sync now**.

**Employees** — every biometric user; salary mode dropdown, amount, standard hours, active
toggle, optional link to a `staff` member. "Needs setup" badge until configured. **+ Add
employee** for someone who has not yet given a fingerprint.

**Payroll** — month picker. Per employee: days worked · hours · mode · rate · computed salary ·
payment status. **Mark Paid** writes a `salaryPayments` doc; paid rows show a green badge with
**Undo**. Footer totals for the month. Excel export via the already-present `xlsx`.

## 9. Deliberately out of scope

- **Wiring payroll into Income & Expenses.** `IncomeExpensesCard.tsx` already adds `staff`
  salaries to expenses off the old `attendance` collection. Auto-adding this module's payroll
  would double-count for anyone present in both. Left as a follow-up decision.
- **The existing `attendance` collection and `AttendanceManagement.tsx`.** Left untouched and
  still reachable from the Admin dashboard tab. This feature uses `attendanceRecords`.
- Leave / holiday management, shift definitions, overtime multipliers, late-arrival penalties.
- Staff-facing self-service view. Admin-only for now.

## 9b. Proxy security

`/api/biotime` reaches an external host carrying the shop's BioTime credentials and returns
staff attendance data, so it is guarded on two axes.

**Authentication.** Every request must carry `Authorization: Bearer <Firebase ID token>` for a
user whose `users/{uid}` document has `role: 'admin'`. Tokens are verified in `api/_auth.ts`
against Google's public signing certificates — signature, `aud`, `iss`, `exp`, `iat` — so no
service-account key has to be created or stored. The role is then read through the Firestore
REST API using the caller's own token, which respects the project's security rules and needs no
elevated credentials. Role results are cached 5 minutes because the page polls once a minute.
The Vite dev middleware enforces the identical check, so the guard is exercised locally rather
than only after deploying.

**SSRF.** The base URL is admin-supplied, which without restriction would let a caller point the
server at an internal address and read the response back. `assertSafeBaseUrl` requires `https:`,
forbids embedded credentials, and restricts the host to a suffix allowlist
(`minervaiot.com`, `zkbiotimecloud.com`, `zkteco.com/.eu/.me`, plus any `BIOTIME_ALLOWED_HOSTS`
and an operator-set `BIOTIME_BASE_URL`). Redirects are refused rather than followed, since a 3xx
would otherwise step around the allowlist. Upstream response bodies are never echoed into error
messages.

Verified: anonymous, forged-token, metadata-endpoint, loopback, private-range, plain-http,
non-allowlisted, `minervaiot.com.evil.com`, and embedded-credential requests are all rejected;
the two genuine BioTime hosts are accepted; the signed-in admin path is unaffected.

## 10. Risk notes

- Billing is production and client-approved. This feature touches **no** billing file, no existing
  collection, and no shared util. The only edits to existing files are one route in `App.tsx`, one
  sidebar item in `Layout.tsx`, and the dev-server plugin in `vite.config.ts`.
- BioTime Cloud's API may not be enabled on every subscription tier. If auth returns 401/403, the
  UI reports it plainly and the manual/CSV paths remain fully usable.
- Timezone: punch times are treated as the tenant's local wall-clock and stored as-is. No UTC
  conversion, which would shift a late-evening checkout onto the wrong day.
