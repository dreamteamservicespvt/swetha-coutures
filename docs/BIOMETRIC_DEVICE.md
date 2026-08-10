# Fingerprint device (ZKTeco K40 Pro)

Every thumb press on the office terminal lands in Firestore and shows up on the
**Attendance** page.

The device pushes to `/iclock/cdata` using ZKTeco's ADMS protocol. One handler serves it in
three places, all running the identical code:

| Where | What runs it | Used for |
|---|---|---|
| Production | `api/iclock/cdata.ts` on Vercel | The ![alt text](image.png)live system |
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

---

## Why the device cannot talk to Vercel directly (verified 2026-08-10)

The K40 Pro reaches the reseller's cloud but never reached Vercel — not one request. The
cause is the TLS certificate, not the TLS version:

| | Certificate issued by |
|---|---|
| Reseller (works) | Amazon RSA 2048 M01 → Amazon Root CA 1 → Starfield Root (2009) |
| `*.vercel.app` (fails) | Google Trust Services WR1 → GTS Root R1 (2016) |

The terminal's System Version is `22.5.10-20170306`, so its trusted-authority list predates
Google Trust Services. It opens the connection, rejects the certificate and hangs up before
sending anything — which is why nothing appears in `deviceRawLogs` or the Vercel logs.

Both hosts require TLS 1.2, and the device does TLS 1.2 fine, so the version is not the
issue and cannot be worked around. **Vercel only issues Google-signed certificates and this
cannot be changed**, so the device needs either a plain-HTTP front door or a certificate
from an authority it trusts.

Proven working on 2026-08-10: with `scripts/device-receiver.ts` on the office LAN and the
device set to plain HTTP, 20 punches arrived and folded into a day record correctly.

---

## Putting Cloudflare in front (the permanent fix)

Gives the device a plain-HTTP address on the internet, so no certificate is involved on the
device's side. Free, and nothing to maintain.

```
Device --plain HTTP :80--> punch.yourdomain.com (Cloudflare) --HTTPS--> Vercel --> Firestore
```

A dedicated subdomain is used so the main website keeps forced HTTPS; only the device's
hostname permits plain HTTP.

### 1. Put the domain on Cloudflare

1. Sign up at [cloudflare.com](https://dash.cloudflare.com/sign-up) — **Free** plan.
2. **Add a site** → enter your domain → choose **Free**.
3. Cloudflare shows two nameservers. Copy them.
4. At the company you bought the domain from, replace its nameservers with those two.
5. Wait for Cloudflare to say **Active** (usually minutes, up to a few hours).

### 2. Tell Vercel about the subdomain

Vercel project → **Settings → Domains → Add** → `punch.yourdomain.com`.
Vercel shows a CNAME target, normally `cname.vercel-dns.com`.

### 3. Add the DNS record in Cloudflare

Cloudflare → **DNS → Records → Add record**:

| Field | Value |
|---|---|
| Type | CNAME |
| Name | `punch` |
| Target | `cname.vercel-dns.com` (whatever Vercel showed) |
| Proxy status | **DNS only** (grey cloud) — for now |

Grey cloud first so Vercel can verify the domain and issue its own certificate. Wait until
Vercel shows **Valid Configuration**, then edit the record and switch it to
**Proxied** (orange cloud). Cloudflare only accepts plain HTTP on proxied records.

### 4. Two SSL settings — these are the ones that matter

Cloudflare → **SSL/TLS**:

- **Overview → Full (strict)**. Cloudflare talks to Vercel over HTTPS, which Vercel requires.
  "Flexible" would make Vercel redirect back to HTTPS and cause an endless loop.
- **Edge Certificates → Always Use HTTPS → OFF**. This is the whole point: with it on,
  Cloudflare redirects the device's plain HTTP to HTTPS and the certificate problem returns.

To keep the main website on forced HTTPS, add **Rules → Page Rules → Create**:
URL `yourdomain.com/*`, setting **Always Use HTTPS → On**. The device's subdomain is not
matched by that rule, so it stays HTTP-friendly.

### 5. Let the device through Cloudflare's bot protection

The terminal's user agent (`iClock`) looks like a bot. Cloudflare → **Security → Bots** →
turn **Bot Fight Mode OFF**, or add a **WAF skip rule** for hostname
`punch.yourdomain.com`. Skipping this usually shows up as the device connecting and then
being silently blocked.

### 6. Point the device at it

`Menu → Comm. → Cloud Server Setting`:

| Setting | Value |
|---|---|
| Server Mode | ADMS |
| Enable Domain Name | ON |
| Server Address | `punch.yourdomain.com` — no `http://`, no trailing slash |
| Enable Proxy Server | OFF |
| HTTPS | **OFF** |

Unplug the device's power, wait 10 seconds, plug it back in.

### 7. Check it

```bash
curl -i "http://punch.yourdomain.com/iclock/cdata?SN=TEST123&options=all"
```

Note `http://`, not `https://`. A correct reply starts `GET OPTION FROM: TEST123`. If you
get a redirect (301/302/308) instead, **Always Use HTTPS** is still on.

Then press a finger on the device and watch the Punches tab.

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

### The endpoint returns 500 / `FUNCTION_INVOCATION_FAILED`

Go to **`https://your-domain.com/api/ping`** first. It reports Node version, whether each
`FIREBASE_*` variable is set, and whether every import and the Firestore connection actually
build. It reveals no secrets.

Two causes have already been hit and fixed, both of which produce an identical, useless 500:

1. **A relative import in `api/` without a `.js` extension.** `package.json` says
   `"type": "module"`, so Node requires the extension. Always write `from './_foo.js'`.
2. **A mangled `FIREBASE_PRIVATE_KEY`.** The code now repairs the common paste mistakes, but
   `/api/ping` will show `build_firestore_store=FAILED` with the real reason if it cannot.

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
