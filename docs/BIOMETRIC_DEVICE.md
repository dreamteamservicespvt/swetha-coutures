# Fingerprint device (ZKTeco K40 Pro)

Every thumb press on the office terminal lands in Firestore and shows up on the
**Attendance** page.

The device pushes to `/iclock/cdata` using ZKTeco's ADMS protocol. One handler serves it in
three places, all running the identical code:

| Where | What runs it | Used for |
|---|---|---|
| Production | `api/iclock/cdata.ts` on Vercel | The live system |
| Your PC | Vite dev server (`npm run dev`) | Testing with the real device on the LAN |
| No hardware | `npm run test:device` | Proving the logic without a device at all |

All the protocol and database logic lives in [api/_deviceIngest.ts](../api/_deviceIngest.ts).

---

## Step 1 — Get the Firebase key (needed for both testing and production)

1. [Firebase Console](https://console.firebase.google.com/) → your **swetha-couture** project
2. Gear icon → **Project settings** → **Service accounts** tab
3. **Generate new private key** → a `.json` file downloads
4. Open it in Notepad and copy three values into your `.env`:

```
FIREBASE_PROJECT_ID=swetha-couture
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@swetha-couture.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

⚠️ **This key bypasses all Firestore security rules.** It belongs in `.env` (gitignored) and
in the Vercel dashboard — nowhere else. Never commit it, never paste it into a chat. If it
leaks, delete the key on that same Service accounts page.

---

## Step 2 — Test on your LAN first

The device does not need internet for this. It only needs to be on the **same network as
your PC** — plugged into the same router, or directly cabled to it.

**a. Find your PC's IP address**

```powershell
ipconfig
```

Look for `IPv4 Address` under your active adapter — something like `192.168.1.7`.

**b. Open the Windows Firewall for port 8080**

Windows blocks incoming connections by default, so the device cannot reach you without this.
Run PowerShell **as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "Fingerprint device" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

**c. Start the dev server**

```bash
npm run dev
```

It prints the exact values to type into the device:

```
➜  Fingerprint device (ADMS): plain HTTP on this LAN
   Server Address 192.168.1.7   Server Port 8080
```

**d. Point the device at your PC**

On the K40 Pro keypad: `Menu → Comm. → Cloud Server Setting`

| Setting | Value |
|---|---|
| Server Mode / Protocol | **ADMS** (some firmware calls it "Domain Name" mode) |
| Enable Domain Name | **OFF** (you are using an IP, not a name) |
| Server Address | your PC's IP, e.g. `192.168.1.7` — no `http://` |
| Server Port | `8080` |
| Enable Proxy Server | **OFF** |

✍️ **Write down whatever was in Server Address before you change it.** You need it to roll
back to the reseller's cloud.

Then reboot the device.

**e. Watch it connect**

Within about a minute your terminal shows:

```
[iclock] Handshake from BOCK200961014 (pending) — NEW DEVICE, approve it on the Attendance page
```

**f. Approve it**

Open <http://localhost:8080/attendance>. A yellow bar shows the device and its serial number.
Check the serial matches the sticker on the device, then click **Approve**.

**g. Press a finger**

```
[iclock] BOCK200961014: 1 punch(es) in — 1 new, 0 already seen, 1 day record(s) updated
```

Then on the Attendance page:

- **Punches** tab — the individual press, with time and type
- **Records** tab — the day's check-in
- **Employees** tab — the person, badged **Needs setup**. Set their pay basis and amount and
  Payroll starts calculating.

Punches made before you approved the device are **not lost** — they are held and added
automatically on approval.

---

## Step 3 — Go live on Vercel

Add the same three variables in **Vercel → your project → Settings → Environment Variables**:

| Name | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | `swetha-couture` |
| `FIREBASE_CLIENT_EMAIL` | from the JSON |
| `FIREBASE_PRIVATE_KEY` | from the JSON |

On `FIREBASE_PRIVATE_KEY`: paste the full PEM including the `BEGIN`/`END` lines. Real newlines
or literal `\n` both work. **Do not include surrounding quotes** — Vercel treats them as part
of the value and the key fails to parse.

Environment variables only apply to new deployments, so **redeploy** after adding them.

Then repoint the device at your live domain:

| Setting | Value |
|---|---|
| Enable Domain Name | **ON** |
| Server Address | `your-domain.com` — no `https://`, no trailing slash |
| Server Port | `443` |

Reboot the device.

### ⚠️ This is the step that may not work

Vercel forces HTTPS and accepts only TLS 1.2/1.3 with modern ciphers. The K40 Pro is a
classic-series terminal that often speaks plain HTTP, or TLS 1.0, and does not reliably follow
redirects. If it connects on your LAN but goes silent against the live domain, that is the
cause — not a bug in the code.

If that happens, the fix is a plain-HTTP relay that the device can reach, forwarding to
Vercel. Ask and it can be rebuilt; the handler itself needs no changes.

---

## Step 4 — Lock it down

Once a real punch has worked, set the allowlist so strangers cannot post attendance to your
public endpoint. In Vercel (and `.env`):

```
DEVICE_SERIALS=BOCK200961014
```

Use the exact serial shown on the Attendance page. Unlisted devices are silently ignored.

---

## Rolling back to the reseller's cloud

Nothing to uninstall. On the device: `Menu → Comm. → Cloud Server Setting`, put back the
address and port you wrote down in Step 2d, and reboot. Punches go back to the reseller
immediately. Everything already in Firestore stays there.

---

## Troubleshooting

Everything is diagnosed from the **`deviceRawLogs`** collection in Firestore — every request
the device made, stored *before* anything tried to interpret it.

Firebase Console → Firestore Database → `deviceRawLogs` → sort by `receivedAt` descending.

### Nothing in `deviceRawLogs` at all

The device is not reaching you.

```powershell
# Does the endpoint answer locally?
curl "http://localhost:8080/iclock/cdata?SN=TEST123"
# expect: GET OPTION FROM: TEST123 ...

# Does it answer from another machine on the LAN? (run from your phone/laptop)
curl "http://192.168.1.7:8080/iclock/cdata?SN=TEST123"
```

If localhost works but the LAN address does not, it is the Windows Firewall — redo Step 2b.

If both work but the device still cannot connect, check `Menu → Comm. → Ethernet` on the
device for a valid IP and gateway, and confirm the address and port you typed.

### Logs appear, but no punches

Check the `path` and `body` of a log entry:

- Only `/iclock/getrequest` → the device is connected but has nothing to send. Press a finger.
- `/iclock/cdata` with an empty body → the device thinks it already uploaded everything. Use
  `Menu → Data Mgt.` to re-send attendance, or reboot it.
- Body has rows but the Punches tab is empty → the device is `pending` or `blocked`. Approve
  it on the Attendance page.

### Punches show the wrong time of day

The device's clock is set to a different timezone than `DEVICE_TZ_OFFSET`. The original string
is always kept in `punchTimeRaw`, so nothing is lost — fix the setting and restart.

### Capturing everything

```
RAW_LOG_MODE=all
```

Logs the command polls too. Set it back to `data` afterwards — it writes about 3,000 extra
documents a day.

### Stopping logs from piling up

Set a TTL policy once and they delete themselves:
Firebase Console → Firestore Database → **TTL** → **Create policy** → collection
`deviceRawLogs`, timestamp field `expiresAt`.

---

## Testing without the device

```bash
npm run test:device
```

54 checks: registration handshake, a normal punch batch, a replayed batch (must not
double-count), hand-edited records surviving a later upload, malformed and binary bodies,
space-separated rows, an unknown serial, a blocked device, command polling, employee names,
the raw log, and the serial allowlist.

---

## What gets stored

| Collection | What it holds |
|---|---|
| `devices` | One per terminal — approval status, last-seen heartbeat |
| `devicePunches` | Every individual press, raw |
| `deviceRawLogs` | Every HTTP request, for debugging. Self-deleting via TTL |
| `attendanceEmployees` | People, auto-created on first punch |
| `attendanceRecords` | One row per person per day — what Payroll reads |

**Fingerprint images and templates are never sent to us and never stored.** Only the punch
event: who, when, in or out, which device.
