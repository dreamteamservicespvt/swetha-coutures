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
import { COLLECTIONS, type DocData, type DocStore } from './_deviceIngest';

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminConfigError';
  }
}

let cachedDb: Firestore | null = null;

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
  // Environment dashboards cannot hold real newlines, so the PEM is pasted with literal
  // \n sequences and unescaped here. Without this the key fails to parse.
  const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

  const missing = [
    !projectId && 'FIREBASE_PROJECT_ID',
    !clientEmail && 'FIREBASE_CLIENT_EMAIL',
    !privateKey && 'FIREBASE_PRIVATE_KEY',
  ].filter(Boolean);

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
