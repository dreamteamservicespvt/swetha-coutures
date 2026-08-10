/**
 * Plain-HTTP receiver for the fingerprint terminal.
 *
 *   npm run device:receiver
 *
 * Why this exists: Vercel forces HTTPS with TLS 1.2+ and SNI, and this K40 Pro's HTTPS
 * stack cannot complete that handshake — the request never leaves the device, which is
 * why nothing at all reached the server. This listens on plain HTTP on the office LAN,
 * which the device can do, and writes to exactly the same Firestore the website reads.
 *
 * It runs the identical handler as the Vercel function (api/_deviceIngest.ts), so there
 * is still one implementation of the protocol — this is only a different front door.
 *
 * The machine running this must stay on and on the same network as the device.
 */
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  decodeBody,
  defaultConfig,
  handleDeviceRequest,
  type DocData,
  type DocStore,
} from '../api/_deviceIngest.ts';

/* ------------------------------------------------------------------ env loading */

/**
 * Reads .env directly rather than relying on a flag or a dependency.
 *
 * FIREBASE_PRIVATE_KEY spans a very long single line wrapped in quotes, which several
 * dotenv implementations mangle; pulling it out with an explicit pattern avoids that.
 */
function loadEnv(): void {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) {
    console.error('\n  No .env file found. Copy .env.example to .env and fill it in.\n');
    process.exit(1);
  }

  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match || match[1] === 'FIREBASE_PRIVATE_KEY') continue;
    if (!process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"(.*)"$/, '$1');
  }

  const key = /FIREBASE_PRIVATE_KEY\s*=\s*"([\s\S]*?)"\s*(?:\r?\n|$)/.exec(raw);
  if (key) process.env.FIREBASE_PRIVATE_KEY = key[1];
}

/* ---------------------------------------------------------------------- store */

function buildStore(): DocStore {
  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();

  let privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
  privateKey = privateKey.replace(/\\n/g, '\n').trim();

  if (!projectId || !clientEmail || !privateKey) {
    console.error('\n  Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env\n');
    process.exit(1);
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  const db: Firestore = getFirestore(app);
  const BATCH_LIMIT = 450;

  return {
    async get(collection, id) {
      const snap = await db.collection(collection).doc(id).get();
      return snap.exists ? (snap.data() as DocData) : null;
    },
    async getMany(collection, ids) {
      const unique = [...new Set(ids)].filter(Boolean);
      const found = new Map<string, DocData>();
      if (unique.length === 0) return found;
      const snaps = await db.getAll(...unique.map((id) => db.collection(collection).doc(id)));
      for (const snap of snaps) if (snap.exists) found.set(snap.id, snap.data() as DocData);
      return found;
    },
    async setMany(collection, entries) {
      const usable = entries.filter((e) => e && e.id);
      for (let i = 0; i < usable.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const e of usable.slice(i, i + BATCH_LIMIT)) {
          batch.set(db.collection(collection).doc(e.id), e.data, { merge: true });
        }
        await batch.commit();
      }
      return usable.length;
    },
    async set(collection, id, data) {
      await db.collection(collection).doc(id).set(data, { merge: true });
    },
  };
}

/* ---------------------------------------------------------------------- server */

interface Address {
  address: string;
  iface: string;
  selfAssigned: boolean;
}

/**
 * Every IPv4 address on this machine, with the adapter it belongs to.
 *
 * 169.254.x addresses are listed rather than hidden. They mean the adapter found no DHCP
 * server — usually a device cabled straight into this PC — and in exactly that case it is
 * the *only* address the device can reach. Filtering them out hides the one that works.
 */
const lanAddresses = (): Address[] =>
  Object.entries(os.networkInterfaces()).flatMap(([iface, entries]) =>
    (entries || [])
      .filter((e) => e.family === 'IPv4' && !e.internal)
      .map((e) => ({
        address: e.address,
        iface,
        selfAssigned: e.address.startsWith('169.254.'),
      }))
  );

loadEnv();
const store = buildStore();
const config = defaultConfig(process.env);
const port = Number(process.env.RECEIVER_PORT) || 80;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://device.local');
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);

  const headers: Record<string, string> = {};
  for (const name of ['user-agent', 'content-type', 'content-length', 'host']) {
    const value = req.headers[name];
    if (value !== undefined) headers[name] = String(value);
  }

  const stamp = new Date().toLocaleTimeString('en-IN');

  // Anything outside /iclock is a browser or a scanner; answer briefly and move on.
  if (!url.pathname.startsWith('/iclock')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Fingerprint receiver is running.\n');
    return;
  }

  try {
    const result = await handleDeviceRequest(
      {
        method: (req.method || 'GET').toUpperCase(),
        path: url.pathname,
        query,
        body: decodeBody(body),
        bodyBytes: body.length,
        headers,
        remoteAddress: req.socket.remoteAddress || '',
      },
      store,
      config
    );

    if (result.log) console.log(`  \x1b[35m${stamp}\x1b[0m  ${result.log}`);
    res.writeHead(result.status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(result.body);
  } catch (error) {
    console.error(`  \x1b[31m${stamp}  ERROR\x1b[0m`, error);
    // Always answer OK: anything else puts the device into an endless retry loop.
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('OK');
  }
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EACCES') {
    console.error(
      `\n  Port ${port} needs administrator rights on Windows.\n` +
        '  Either run this terminal as Administrator, or use another port:\n' +
        '    set RECEIVER_PORT=8080 && npm run device:receiver\n'
    );
  } else if (error.code === 'EADDRINUSE') {
    console.error(
      `\n  Port ${port} is already being used by another program.\n` +
        '  Close it, or use another port:\n' +
        '    set RECEIVER_PORT=8080 && npm run device:receiver\n'
    );
  } else {
    console.error('\n ', error.message, '\n');
  }
  process.exit(1);
});

server.listen(port, '0.0.0.0', () => {
  const addresses = lanAddresses();
  console.log('');
  console.log('  \x1b[32m✓ Fingerprint receiver running\x1b[0m');
  console.log('');
  console.log('  Set these on the device — Menu > Comm. > Cloud Server Setting:');
  console.log('');
  console.log('    Server Mode          \x1b[36mADMS\x1b[0m');
  console.log('    Enable Domain Name   \x1b[36mOFF\x1b[0m');
  for (const { address, iface, selfAssigned } of addresses) {
    const note = selfAssigned
      ? '  \x1b[33m<- use this if the device is cabled straight to this PC\x1b[0m'
      : '';
    console.log(`    Server Address       \x1b[36m${address}\x1b[0m  (${iface})${note}`);
  }
  if (addresses.length === 0) console.log('    Server Address       (no network address found)');
  console.log('');
  console.log('    Pick the address on the SAME adapter the device is plugged into.');
  console.log(`    Server Port          \x1b[36m${port}\x1b[0m`);
  console.log('    Enable Proxy Server  \x1b[36mOFF\x1b[0m');
  console.log('    HTTPS                \x1b[36mOFF\x1b[0m   <-- important');
  console.log('');
  console.log('  Then unplug the device, wait 10 seconds, plug it back in.');
  console.log('  Punches appear below and on the website within seconds.');
  console.log('  Leave this window open. Press Ctrl+C to stop.');
  console.log('');
});
