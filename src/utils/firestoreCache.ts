import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Short-lived cache for whole-collection reads.
 *
 * Several panels on the same screen each used to call `getDocs(collection(db, 'bills'))`
 * independently — the admin dashboard alone did it four times, pulling ~350 documents over
 * the wire on each. This coalesces concurrent callers onto one request and reuses the result
 * for a few seconds, which is the difference between a page that paints once and a page that
 * visibly reflows as each panel arrives.
 *
 * The TTL is deliberately short. This is a burst cache to stop duplicate work within a single
 * page render, not a data layer — anything that writes should call {@link invalidateCollection}
 * so the next read is fresh, and a browser refresh always starts empty.
 */

interface CacheEntry {
  at: number;
  docs: { id: string; data: any }[];
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<{ id: string; data: any }[]>>();

/**
 * How long a fetched collection stays reusable.
 *
 * 30s covers the realistic case of moving between pages that read the same data (dashboard →
 * customers → billing) without re-downloading hundreds of documents each time. Writes call
 * {@link invalidateCollection}, so this never serves data the user has just changed.
 */
const DEFAULT_TTL_MS = 30_000;

export interface CachedDoc<T = any> {
  id: string;
  data: T;
}

/**
 * Reads a whole collection, reusing a recent result or joining an in-flight request.
 * Returns plain `{ id, data }` pairs so callers do not depend on Firestore snapshot types.
 */
export async function fetchCollectionCached<T = any>(
  name: string,
  options: { maxAgeMs?: number; force?: boolean } = {}
): Promise<CachedDoc<T>[]> {
  const maxAge = options.maxAgeMs ?? DEFAULT_TTL_MS;

  if (!options.force) {
    const hit = cache.get(name);
    if (hit && Date.now() - hit.at < maxAge) return hit.docs as CachedDoc<T>[];

    const pending = inflight.get(name);
    if (pending) return pending as Promise<CachedDoc<T>[]>;
  }

  const request = (async () => {
    try {
      const snapshot = await getDocs(collection(db, name));
      const docs = snapshot.docs.map((snap) => ({ id: snap.id, data: snap.data() }));
      cache.set(name, { at: Date.now(), docs });
      return docs;
    } finally {
      inflight.delete(name);
    }
  })();

  inflight.set(name, request);
  return request as Promise<CachedDoc<T>[]>;
}

/** Convenience: documents as `{ id, ...fields }`, the shape most call sites already use. */
export async function fetchDocsCached<T = any>(
  name: string,
  options?: { maxAgeMs?: number; force?: boolean }
): Promise<(T & { id: string })[]> {
  const docs = await fetchCollectionCached(name, options);
  return docs.map((entry) => ({ id: entry.id, ...entry.data })) as (T & { id: string })[];
}

/** Drop cached data after a write so the next read reflects it. */
export function invalidateCollection(...names: string[]): void {
  names.forEach((name) => {
    cache.delete(name);
    inflight.delete(name);
  });
}

export function invalidateAll(): void {
  cache.clear();
  inflight.clear();
}
