/**
 * Firebase Admin SDK initialisation — SERVER SIDE ONLY.
 *
 * Must never be imported from anything under src/. It holds a service-account private key,
 * which bypasses Firestore security rules entirely; bundling it into the browser would hand
 * every visitor full read/write access to the whole database.
 *
 * Note this deliberately differs from api/_auth.ts, which verifies Firebase ID tokens by
 * hand against Google's public certificates precisely to avoid needing a service account.
 * That approach works for *checking who a caller is*, but the fingerprint device cannot
 * authenticate at all, so writing its punches needs real admin credentials.
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS, type DocData, type DocStore } from './_deviceIngest.js';

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminConfigError';
  }
}

let cachedDb: Firestore | null = null;

/**
 * Turns whatever ended up in the environment variable into a usable PEM.
 *
 * Two things reliably go wrong when a service-account key is moved by hand from a JSON
 * file into a hosting dashboard, and both produce the same opaque OpenSSL error
 * ("DECODER routines::unsupported") with no hint as to the cause:
 *
 *  1. The surrounding double quotes from the JSON get copied along with the value, so the
 *     string starts with `"` instead of `-----BEGIN`.
 *  2. The `\n` escape sequences stay literal, because most dashboards cannot hold real
 *     newlines in a single-line field.
 *
 * Both are recoverable here, so they are recovered rather than turned into a support
 * problem. Exported for the /api/ping diagnostic.
 */
export function normalisePrivateKey(raw: string): string {
  let key = String(raw ?? '').trim();

  // Strip one layer of matching wrapping quotes.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // Un-escape literal \n (and the \r\n some editors introduce).
  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  key = key.trim();

  /**
   * Re-attach the PEM armour when only the base64 body was copied.
   *
   * Selecting the key inside a JSON viewer very easily grabs the middle and leaves the
   * `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines behind. The result is
   * still a perfectly good key, just not a parseable PEM, and OpenSSL's only complaint is
   * "DECODER routines::unsupported".
   */
  if (!key.startsWith('-----BEGIN') && /^[A-Za-z0-9+/=\s]+$/.test(key) && key.length > 100) {
    // PEM bodies are wrapped at 64 characters; Node's parser expects that shape.
    const body = key.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') ?? '';
    key = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  }

  return key.trim();
}

/**
 * Returns the shared Firestore handle, initialising the app on first use.
 *
 * Serverless containers are reused between invocations, so this module stays loaded and
 * `initializeApp` would throw "app already exists" on the second request. The getApps()
 * check is what makes the function safe to call on every punch.
 */
export function getAdminDb(env: NodeJS.ProcessEnv = process.env): Firestore {
  if (cachedDb) return cachedDb;

  const projectId = (env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = (env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = normalisePrivateKey(env.FIREBASE_PRIVATE_KEY || '');

  const missing = [
    !projectId && 'FIREBASE_PROJECT_ID',
    !clientEmail && 'FIREBASE_CLIENT_EMAIL',
    !privateKey && 'FIREBASE_PRIVATE_KEY',
  ].filter(Boolean);

  // Caught here rather than left to OpenSSL, which reports only
  // "DECODER routines::unsupported" and gives no clue what is actually wrong.
  if (privateKey && !privateKey.startsWith('-----BEGIN')) {
    throw new AdminConfigError(
      'FIREBASE_PRIVATE_KEY does not look like a PEM key — it should start with ' +
        `"-----BEGIN PRIVATE KEY-----" but starts with "${privateKey.slice(0, 12)}...". ` +
        'Copy the private_key value out of the service-account JSON without the ' +
        'surrounding double quotes.'
    );
  }

  if (missing.length > 0) {
    throw new AdminConfigError(
      `Missing Firebase Admin environment variables: ${missing.join(', ')}. ` +
        'Locally: add them to .env and restart `npm run dev`. ' +
        'In production: Vercel → Settings → Environment Variables, then redeploy. ' +
        'Get the values from Firebase Console → Project settings → Service accounts → ' +
        'Generate new private key. See docs/BIOMETRIC_DEVICE.md.'
    );
  }

  const app: App =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  cachedDb = getFirestore(app);
  return cachedDb;
}

/** Firestore rejects a batch over 500 writes. */
const BATCH_LIMIT = 450;

/**
 * Wraps Firestore in the small DocStore interface the ingest logic expects, so that logic
 * stays free of any Firebase import and can be exercised against an in-memory store.
 */
export function createFirestoreStore(db: Firestore): DocStore {
  return {
    async get(collection, id) {
      const snapshot = await db.collection(collection).doc(id).get();
      return snapshot.exists ? (snapshot.data() as DocData) : null;
    },

    /** One round trip for many documents, rather than one read per punch. */
    async getMany(collection, ids) {
      const unique = [...new Set(ids)].filter(Boolean);
      const found = new Map<string, DocData>();
      if (unique.length === 0) return found;

      const refs = unique.map((id) => db.collection(collection).doc(id));
      const snapshots = await db.getAll(...refs);

      for (const snapshot of snapshots) {
        if (snapshot.exists) found.set(snapshot.id, snapshot.data() as DocData);
      }
      return found;
    },

    async setMany(collection, entries) {
      const usable = entries.filter((entry) => entry && entry.id);
      if (usable.length === 0) return 0;

      for (let offset = 0; offset < usable.length; offset += BATCH_LIMIT) {
        const batch = db.batch();
        for (const entry of usable.slice(offset, offset + BATCH_LIMIT)) {
          // merge:true is what makes this a patch rather than a replace — without it,
          // writing {lastSeenAt} would erase the rest of the device document.
          batch.set(db.collection(collection).doc(entry.id), entry.data, { merge: true });
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

/** Convenience: the configured store, or a thrown AdminConfigError if env vars are missing. */
export function getDeviceStore(env: NodeJS.ProcessEnv = process.env): DocStore {
  return createFirestoreStore(getAdminDb(env));
}

export { COLLECTIONS };
