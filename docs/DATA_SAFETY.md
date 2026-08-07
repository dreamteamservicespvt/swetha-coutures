# Data safety & disaster recovery

Everything the shop runs on lives in one Firebase project. This document describes what is
protected today, and what else is worth adding — in the order the effort pays off.

---

## 1. What exists now

### Excel backup (`/backup`, admin only)

- Exports **27 Firestore collections** — bills, orders, customers, inventory, income,
  expenses, employees, attendance, payroll, settings and every catalog/reference collection.
- Period control: everything · one month · month range · one day · day range.
- Reference data (product names, descriptions, categories, employees, settings) is **always
  exported in full**, even for a one-day file, so any single file can stand on its own.
- Each collection is one sheet, each document one row, `__id` holds the Firestore id.
- A `_manifest` sheet records the format version, when it was taken, the period, per-sheet
  row counts, and how to restore.

**Losslessness.** A "pretty report" export is useless for recovery, so cell values are tagged:

| Cell value | Means |
|---|---|
| `@ts:2026-07-27T10:44:11.748Z` | a date/time — restored as a Firestore `Timestamp`, not a string |
| `@json:{...}` | a nested object or array (bill `products`, `paymentRecords`, order `sizes`) |
| `@null` | an explicit null |
| `@empty` | an explicit empty string |
| *(blank)* | the document does **not** have this field — restore leaves it absent |
| `@lit:@foo` | plain text that happens to start with `@` |

Timestamps nested *inside* arrays and objects are converted too, so a bill's payment dates
survive the round trip.

### Restore

- Reads the workbook, shows a preview (rows per collection) and requires typing `RESTORE`.
- Writes each row back **under its original id**, so re-importing the same file twice is
  harmless — it overwrites the same documents instead of duplicating them.
- **Merge on** (default) keeps live fields the file doesn't have — right for a monthly file.
  **Merge off** makes each document exactly match the backup — right for a fresh project.
- Batched at 400 writes per commit, so large files don't hit Firestore's batch limit.

**This is the plug-and-play path you asked for:** create a new Firebase project, put its
config in `.env`, deploy, sign in, `/backup` → *Restore from file* → done.

*Verified end to end:* 705 records exported, restored back, and every figure in the app read
identically afterwards.

### Backup reminders

- State lives in Firestore (`syncState/backup`), **not** localStorage — clearing site data or
  switching to a phone must never make the app think a backup exists when it doesn't.
- **First run:** a dialog that cannot be dismissed by clicking away or pressing Escape asks
  for a full "All time" export.
- **After that:** any *completed* month with no backup triggers the reminder on every page
  load. Only finished months count — nagging on the 3rd for a month still running trains
  people to dismiss it.
- "Remind me in 3 days" snoozes; taking the backup clears it.
- A full export retroactively marks earlier months as covered.

### Credentials

Firebase and Cloudinary config moved out of source into `.env` (see `.env.example`).
Note that a Firebase **web** config is public by design — it identifies the project, it does
not authorise anything. What actually protects the data is Firestore Security Rules.

---

## 2. Do this next — Firestore Security Rules

**This is the single highest-value item on this page.** The Excel backup protects against
*losing* data. Rules protect against someone *reading or deleting* it.

Check the current rules at Firebase Console → Firestore → Rules. If they read anything like
`allow read, write: if true;`, every record is world-readable by anyone who finds the project
id — which is in the JS bundle of any deployed site. A starting point:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isAdmin() {
      return signedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Bills shared by public link are fetched by token, not by id.
    match /bills/{billId} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
    match /{document=**} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
  }
}
```

Two related items:
- The public bill view queries `bills` by `shareToken` while signed out, so that query needs
  its own allowance — narrow it to token lookups rather than opening the whole collection.
- `createAdminUser()` in `AuthContext` creates `swetha@gmail.com` with the password equal to
  the email. Change that password now; anyone who reads the repo has admin.

---

## 3. Also enable — free, five minutes each

**Firebase scheduled backups.** Firestore has native Point-in-Time Recovery and scheduled
exports to Cloud Storage. On Blaze this is a few rupees a month and gives daily server-side
snapshots with no human in the loop. It is strictly better than a manual Excel file for
*recent* loss — use both.

**Keep backup files off the same machine.** A backup on the laptop that dies with the laptop
is not a backup. Save each export to Google Drive / OneDrive as well; the file is ~5 MB.

**Cloudinary.** Design images and payment screenshots live there, not in Firestore. The Excel
backup stores their URLs, not the images. If the Cloudinary account is lost the URLs break —
worth a periodic download of that media library too.

---

## 4. Your Google Sheets idea

You suggested streaming data to a Google Sheet in real time as a second copy. That instinct
is right — the gap the Excel backup leaves is *the days since the last export*. Options, worst
to best:

**(a) Write to Sheets from the browser.** Rejected: it needs a Google API credential in the
browser bundle, so anyone could read or overwrite the sheet. Do not do this.

**(b) Firestore trigger → Sheets (recommended).** A Cloud Function on
`onDocumentWritten('bills/{id}')` (plus orders, customers, income, expenses) appends the
change to a Sheet via a service account. Credentials stay server-side, it is continuous, and
recovery means downloading the sheet as `.xlsx` and importing it here. Needs the Blaze plan.

**(c) Scheduled Cloud Function, hourly/daily.** Same idea, simpler: read the collections on a
schedule and rewrite the sheet. Cheaper and less code than (b), at the cost of a delay
measured in hours instead of seconds.

**Important caveat:** a Google Sheet caps at 10 million cells and gets slow long before that.
At the current 357 bills this is fine for years; it is a safety net, not the primary store.

**If you want a true real-time second copy**, Firestore PITR (§3) is less work than any of
these and recovers to any microsecond in the last 7 days.

### Suggested layering

| Layer | Covers | Effort |
|---|---|---|
| Security Rules | unauthorised read/delete | 30 min — **do first** |
| Monthly Excel backup (built) | total loss of the Firebase project | already done |
| Firestore PITR + scheduled export | accidental deletion in the last 7 days | 15 min, Blaze |
| Sheets mirror (b or c) | loss between manual backups | half a day |
| Copies in Drive/OneDrive | laptop failure, theft | ongoing habit |

---

## 5. If the worst happens

1. Create a new Firebase project. Enable Authentication (email/password) and Firestore.
2. Put its config into `.env` (and Vercel's environment variables), then deploy.
3. Sign in — the first login for `swetha@gmail.com` bootstraps the admin user.
4. `/backup` → **Restore from file** → pick the newest export → untick **Merge** (an empty
   project should match the file exactly) → type `RESTORE`.
5. Check the dashboard's "To Collect" figure against the last known good number.
6. Re-apply Security Rules. A restored project starts with test-mode rules.

Restoring is idempotent: if it fails halfway, run it again.
