import { collection, getDocs, writeBatch, doc, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Catalog management for Services (bill sub-item descriptions) and Products (bill product names).
 *
 * "Services" and "Products" are derived from bill data, so renaming / merging / deleting them
 * rewrites the matching text inside historical bills and orders (amounts are never changed),
 * plus the master `descriptions` / `products` lists used by the billing dropdowns. All matching
 * is case-insensitive + trimmed, which is what fixes the "Stitching"/"stitching" duplicates.
 */

export type CatalogKind = 'service' | 'product';

const norm = (s: any): string => (typeof s === 'string' ? s.trim().toLowerCase() : '');

const masterCollection = (kind: CatalogKind) => (kind === 'service' ? 'descriptions' : 'products');

/** Commit a list of {ref, data} updates in batches of 450 (Firestore limit is 500). */
async function commitUpdates(updates: { ref: any; data: any }[]): Promise<number> {
  let committed = 0;
  for (let i = 0; i < updates.length; i += 450) {
    const slice = updates.slice(i, i + 450);
    const batch = writeBatch(db);
    slice.forEach((u) => batch.update(u.ref, u.data));
    await batch.commit();
    committed += slice.length;
  }
  return committed;
}

/**
 * How many bills + orders currently reference this service/product name (case-insensitive)?
 * Used to preview the impact before applying a rename / merge / delete.
 */
export async function countUsage(kind: CatalogKind, name: string): Promise<{ bills: number; orders: number }> {
  const target = norm(name);
  const [billsSnap, ordersSnap] = await Promise.all([
    getDocs(collection(db, 'bills')),
    getDocs(collection(db, 'orders')),
  ]);

  const billHit = (data: any): boolean => {
    if (kind === 'product') {
      return Array.isArray(data.products) && data.products.some((p: any) => norm(p?.name) === target);
    }
    const inProducts =
      Array.isArray(data.products) &&
      data.products.some(
        (p: any) => Array.isArray(p?.descriptions) && p.descriptions.some((d: any) => norm(d?.description) === target)
      );
    const inItems = Array.isArray(data.items) && data.items.some((it: any) => norm(it?.description) === target);
    return inProducts || inItems;
  };

  const orderHit = (data: any): boolean => {
    if (kind === 'product') {
      return Array.isArray(data.products) && data.products.some((p: any) => norm(p?.name) === target);
    }
    const inProducts =
      Array.isArray(data.products) &&
      data.products.some(
        (p: any) => Array.isArray(p?.descriptions) && p.descriptions.some((d: any) => norm(d?.description) === target)
      );
    const inItems = Array.isArray(data.items) && data.items.some((it: any) => norm(it?.description) === target);
    return inProducts || inItems;
  };

  return {
    bills: billsSnap.docs.filter((d) => billHit(d.data())).length,
    orders: ordersSnap.docs.filter((d) => orderHit(d.data())).length,
  };
}

/** Rewrite one document's products/items, returning a new value if anything changed (else null). */
function rewriteDoc(kind: CatalogKind, data: any, from: string, to: string): any | null {
  const target = norm(from);
  let changed = false;

  const products = Array.isArray(data.products)
    ? data.products.map((p: any) => {
        let prod = p;
        if (kind === 'product' && norm(p?.name) === target) {
          prod = { ...prod, name: to };
          changed = true;
        }
        if (kind === 'service' && Array.isArray(p?.descriptions)) {
          const descriptions = p.descriptions.map((d: any) => {
            if (norm(d?.description) === target) {
              changed = true;
              return { ...d, description: to };
            }
            return d;
          });
          prod = { ...prod, descriptions };
        }
        return prod;
      })
    : data.products;

  let items = data.items;
  if (kind === 'service' && Array.isArray(data.items)) {
    items = data.items.map((it: any) => {
      if (norm(it?.description) === target) {
        changed = true;
        return { ...it, description: to };
      }
      return it;
    });
  }

  if (!changed) return null;
  const update: any = {};
  if (products !== undefined) update.products = products;
  if (kind === 'service' && items !== undefined) update.items = items;
  return update;
}

/**
 * Rename a service/product to `newName` everywhere (bills, orders, master list). If `newName`
 * already exists this is effectively a MERGE (both collapse into one). Amounts are untouched.
 */
export async function renameCatalogEntry(
  kind: CatalogKind,
  oldName: string,
  newName: string
): Promise<{ billsUpdated: number; ordersUpdated: number }> {
  const to = newName.trim();
  if (!to) throw new Error('New name cannot be empty');

  const [billsSnap, ordersSnap] = await Promise.all([
    getDocs(collection(db, 'bills')),
    getDocs(collection(db, 'orders')),
  ]);

  const billUpdates: { ref: any; data: any }[] = [];
  billsSnap.docs.forEach((d) => {
    const update = rewriteDoc(kind, d.data(), oldName, to);
    if (update) billUpdates.push({ ref: doc(db, 'bills', d.id), data: update });
  });

  const orderUpdates: { ref: any; data: any }[] = [];
  ordersSnap.docs.forEach((d) => {
    const update = rewriteDoc(kind, d.data(), oldName, to);
    if (update) orderUpdates.push({ ref: doc(db, 'orders', d.id), data: update });
  });

  const billsUpdated = await commitUpdates(billUpdates);
  const ordersUpdated = await commitUpdates(orderUpdates);

  // Update the master catalog list: drop the old variant, ensure the canonical exists.
  await deleteFromMaster(kind, oldName);
  await ensureInMaster(kind, to);

  return { billsUpdated, ordersUpdated };
}

/** Delete every master-list doc whose name matches `name` (case-insensitive). */
async function deleteFromMaster(kind: CatalogKind, name: string): Promise<number> {
  const target = norm(name);
  const snap = await getDocs(collection(db, masterCollection(kind)));
  const toDelete = snap.docs.filter((d) => {
    const data = d.data();
    return norm(data.name) === target || norm(data.description) === target;
  });
  if (toDelete.length === 0) return 0;
  const batch = writeBatch(db);
  toDelete.forEach((d) => batch.delete(doc(db, masterCollection(kind), d.id)));
  await batch.commit();
  return toDelete.length;
}

/** Add `name` to the master list if no case-insensitive match already exists. */
export async function ensureInMaster(kind: CatalogKind, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const target = clean.toLowerCase();
  const snap = await getDocs(collection(db, masterCollection(kind)));
  const exists = snap.docs.some((d) => {
    const data = d.data();
    return norm(data.name) === target || norm(data.description) === target;
  });
  if (exists) return;
  if (kind === 'product') {
    await addDoc(collection(db, 'products'), { name: clean, createdAt: new Date(), usageCount: 1 });
  } else {
    await addDoc(collection(db, 'descriptions'), { name: clean, description: clean, createdAt: new Date(), usageCount: 1 });
  }
}

/** Create a new catalog entry (case-insensitive dedup). Returns false if it already existed. */
export async function createCatalogEntry(kind: CatalogKind, name: string): Promise<boolean> {
  const clean = name.trim();
  if (!clean) throw new Error('Name cannot be empty');
  const target = clean.toLowerCase();
  const snap = await getDocs(collection(db, masterCollection(kind)));
  const exists = snap.docs.some((d) => {
    const data = d.data();
    return norm(data.name) === target || norm(data.description) === target;
  });
  if (exists) return false;
  await ensureInMaster(kind, clean);
  return true;
}

/**
 * Delete a catalog entry from the master list only. Bill/order amounts are NOT touched, so if the
 * name still appears in past bills its ROI history remains — use {@link renameCatalogEntry} (merge)
 * to fold it into another entry instead. Returns how many master docs were removed.
 */
export async function deleteCatalogEntry(kind: CatalogKind, name: string): Promise<number> {
  return deleteFromMaster(kind, name);
}
