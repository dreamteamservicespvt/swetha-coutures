/**
 * Backup & restore engine.
 *
 * Design goal: an exported workbook must be enough to rebuild the business from nothing —
 * point the app at an empty Firebase project, import the file, and be back in business.
 * That rules out a "pretty report" export; every field of every document has to survive the
 * round trip, including nested objects, arrays and Firestore Timestamps.
 *
 * How the round trip stays lossless:
 *  - Each collection becomes one sheet. Each document is one row, `__id` holds its id.
 *  - Scalars are written as-is so the sheet is readable and editable in Excel.
 *  - Objects and arrays are written as JSON text, tagged so the importer knows to parse them.
 *  - Timestamps are written in ISO form with a `@ts:` marker, so they come back as
 *    Timestamps rather than as strings that only *look* like dates.
 * A `_manifest` sheet records what the file contains and how it was produced.
 */
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { db } from '@/lib/firebase';
import {
  BACKUP_COLLECTIONS,
  BACKUP_FORMAT_VERSION,
  CollectionSpec,
  MANIFEST_SHEET,
  MEDIA_SHEET,
  isReferenceCollection,
} from './backupSchema';

/* ------------------------------------------------------------------ encoding */

const TS_PREFIX = '@ts:';
const JSON_PREFIX = '@json:';
const NULL_MARKER = '@null';
/**
 * A field that genuinely holds "". Needed because rows are padded to a common column set,
 * so a blank cell has to mean "this document does not have this field" — otherwise a
 * restore would add null fields to every document that happened to lack one.
 */
const EMPTY_MARKER = '@empty';

/** Normalises the many date shapes in this codebase to a JS Date, or null. */
export function toDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  if (typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1e6);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

const isTimestampLike = (value: any) =>
  value &&
  typeof value === 'object' &&
  (typeof value.toDate === 'function' || ('seconds' in value && 'nanoseconds' in value));

/** One Firestore field -> one spreadsheet cell. */
function encodeValue(value: any): string | number | boolean {
  if (value === null || value === undefined) return NULL_MARKER;
  if (isTimestampLike(value)) {
    const date = toDate(value);
    return date ? `${TS_PREFIX}${date.toISOString()}` : NULL_MARKER;
  }
  if (typeof value === 'object') {
    // Nested Timestamps inside arrays/objects (e.g. bill payment records) are converted
    // first, so they survive JSON.stringify as recognisable markers rather than as `{}`.
    return `${JSON_PREFIX}${JSON.stringify(deepEncode(value))}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const text = String(value);
  if (text === '') return EMPTY_MARKER;
  // A plain string that happens to start with a marker would be misread on import.
  return text.startsWith('@') ? `@lit:${text}` : text;
}

function deepEncode(value: any): any {
  if (value === null || value === undefined) return null;
  if (isTimestampLike(value)) {
    const date = toDate(value);
    return date ? `${TS_PREFIX}${date.toISOString()}` : null;
  }
  if (Array.isArray(value)) return value.map(deepEncode);
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    Object.entries(value).forEach(([key, item]) => {
      out[key] = deepEncode(item);
    });
    return out;
  }
  return value;
}

/** One spreadsheet cell -> one Firestore field. */
export function decodeValue(value: any): any {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  const text = String(value);
  if (text === NULL_MARKER) return null;
  if (text === EMPTY_MARKER) return '';
  if (text.startsWith(TS_PREFIX)) {
    const date = new Date(text.slice(TS_PREFIX.length));
    return isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
  }
  if (text.startsWith(JSON_PREFIX)) {
    try {
      return deepDecode(JSON.parse(text.slice(JSON_PREFIX.length)));
    } catch {
      return text;
    }
  }
  if (text.startsWith('@lit:')) return text.slice(5);
  return text;
}

function deepDecode(value: any): any {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(deepDecode);
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    Object.entries(value).forEach(([key, item]) => {
      out[key] = deepDecode(item);
    });
    return out;
  }
  if (typeof value === 'string' && value.startsWith(TS_PREFIX)) {
    const date = new Date(value.slice(TS_PREFIX.length));
    return isNaN(date.getTime()) ? value : Timestamp.fromDate(date);
  }
  return value;
}

/* -------------------------------------------------------------------- export */

export interface BackupRange {
  /** null = everything, ever. */
  start: Date | null;
  end: Date | null;
  /** Shown in the file name and manifest, e.g. "July 2026" or "All time". */
  label: string;
}

export interface BackupProgress {
  collection: string;
  index: number;
  total: number;
  rows: number;
}

export interface BackupResult {
  filename: string;
  totalRows: number;
  perCollection: { name: string; label: string; rows: number; filtered: boolean }[];
  range: BackupRange;
  generatedAt: Date;
}

/** True when a document falls inside the range, using the first date field it actually has. */
function inRange(data: any, spec: CollectionSpec, range: BackupRange): boolean {
  if (!range.start || !range.end) return true;
  if (isReferenceCollection(spec)) return true;

  for (const field of spec.dateFields) {
    if (data[field] === undefined || data[field] === null) continue;
    const date = toDate(data[field]);
    if (!date) continue;
    return date >= range.start && date <= range.end;
  }
  // A record with no usable date is included rather than dropped — losing data is worse
  // than an occasional extra row in a monthly file.
  return true;
}

export async function exportBackup(
  range: BackupRange,
  onProgress?: (progress: BackupProgress) => void
): Promise<BackupResult> {
  const workbook = XLSX.utils.book_new();
  const perCollection: BackupResult['perCollection'] = [];
  let totalRows = 0;

  for (let index = 0; index < BACKUP_COLLECTIONS.length; index++) {
    const spec = BACKUP_COLLECTIONS[index];
    let rows: Record<string, any>[] = [];

    try {
      const snapshot = await getDocs(collection(db, spec.name));
      const columns = new Set<string>(['__id']);

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (!inRange(data, spec, range)) return;

        const row: Record<string, any> = { __id: docSnap.id };
        Object.entries(data).forEach(([key, value]) => {
          columns.add(key);
          row[key] = encodeValue(value);
        });
        rows.push(row);
      });

      // Every row must carry every column or XLSX drops cells for sparse documents.
      const columnList = Array.from(columns);
      rows = rows.map((row) => {
        const complete: Record<string, any> = {};
        columnList.forEach((column) => {
          complete[column] = row[column] === undefined ? '' : row[column];
        });
        return complete;
      });

      const sheet = XLSX.utils.json_to_sheet(rows, { header: columnList });
      XLSX.utils.book_append_sheet(workbook, sheet, spec.sheet.slice(0, 31));
    } catch (error) {
      // A collection that does not exist yet, or that rules deny, must not abort the whole
      // backup — the sheet is written empty and the manifest records the shortfall.
      console.error(`Backup: could not read "${spec.name}"`, error);
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet([{ __id: '', __error: String(error) }]),
        spec.sheet.slice(0, 31)
      );
    }

    perCollection.push({
      name: spec.name,
      label: spec.label,
      rows: rows.length,
      filtered: !isReferenceCollection(spec) && !!range.start,
    });
    totalRows += rows.length;
    onProgress?.({ collection: spec.label, index: index + 1, total: BACKUP_COLLECTIONS.length, rows: rows.length });
  }

  /*
   * Media inventory.
   *
   * Design images, payment screenshots and the business logo live in Cloudinary, not in
   * Firestore — the documents only hold URLs. If that Cloudinary account is ever lost, the
   * URLs in the sheets above are just dead links with no record of what they were. This sheet
   * is the catalogue: every image the business references, what it belongs to, and where it
   * came from, so the media can be re-downloaded (or chased up) deliberately.
   */
  const mediaRows: any[][] = [['Type', 'Belongs to', 'Reference', 'URL']];
  const seenUrls = new Set<string>();
  const addMedia = (type: string, owner: string, reference: string, url?: string) => {
    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) return;
    if (seenUrls.has(url)) return;
    seenUrls.add(url);
    mediaRows.push([type, owner, reference, url]);
  };

  try {
    const [billDocs, orderDocs, designDocs, settingDocs] = await Promise.all([
      getDocs(collection(db, 'bills')),
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'designs')).catch(() => ({ docs: [] as any[] })),
      getDocs(collection(db, 'settings')).catch(() => ({ docs: [] as any[] })),
    ]);

    billDocs.docs.forEach((snap) => {
      const data = snap.data();
      addMedia('Payment screenshot', 'Bill', data.billId || snap.id, data.paymentScreenshot);
      addMedia('QR code', 'Bill', data.billId || snap.id, data.qrCodeUrl);
    });

    orderDocs.docs.forEach((snap) => {
      const data = snap.data();
      const label = data.orderId || data.orderNumber || snap.id;
      (Array.isArray(data.items) ? data.items : []).forEach((item: any, index: number) => {
        (Array.isArray(item?.designImages) ? item.designImages : []).forEach((url: string) => {
          addMedia('Design image', 'Order', `${label} · item ${index + 1}`, url);
        });
      });
      (Array.isArray(data.designImages) ? data.designImages : []).forEach((url: string) => {
        addMedia('Design image', 'Order', label, url);
      });
    });

    (designDocs.docs || []).forEach((snap: any) => {
      addMedia('Design render', 'Design', snap.id, snap.data()?.imageUrl);
    });

    (settingDocs.docs || []).forEach((snap: any) => {
      const data = snap.data();
      addMedia('Business logo', 'Settings', snap.id, data?.logo || data?.businessLogo);
    });
  } catch (error) {
    console.error('Backup: could not build the media inventory', error);
    mediaRows.push(['ERROR', '', '', String(error)]);
  }

  const mediaSheet = XLSX.utils.aoa_to_sheet(mediaRows);
  mediaSheet['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 28 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, mediaSheet, MEDIA_SHEET);

  const generatedAt = new Date();

  // Manifest first in reading order, so anyone opening the file sees what it is.
  const manifest: any[][] = [
    ["Swetha's Couture — data backup"],
    [],
    ['Format version', BACKUP_FORMAT_VERSION],
    ['Generated at', generatedAt.toISOString()],
    ['Generated at (local)', generatedAt.toLocaleString('en-IN')],
    ['Period', range.label],
    ['From', range.start ? range.start.toISOString() : 'All time'],
    ['To', range.end ? range.end.toISOString() : 'All time'],
    ['Collections', BACKUP_COLLECTIONS.length],
    ['Total rows', totalRows],
    ['Images catalogued', Math.max(0, mediaRows.length - 1)],
    [],
    ['Collection', 'Label', 'Rows', 'Date-filtered'],
    ...perCollection.map((item) => [item.name, item.label, item.rows, item.filtered ? 'yes' : 'no (full)']),
    [],
    ['HOW TO RESTORE'],
    ['1', 'Open the app, sign in as admin, go to Backup & Restore in the sidebar.'],
    ['2', 'Choose "Restore from file" and pick this workbook.'],
    ['3', 'Restore writes each row back to its collection using the __id column.'],
    [],
    ['IMAGES'],
    ['', 'Design images and payment screenshots are stored in Cloudinary, not here.'],
    ['', 'The _media sheet lists every image URL so they can be re-downloaded if needed.'],
    [],
    ['CELL FORMAT (do not change these prefixes when editing by hand)'],
    ['@ts:<ISO>', 'a date/time value'],
    ['@json:<JSON>', 'a nested object or list'],
    ['@null', 'an empty value'],
    ['@lit:<text>', 'plain text that happens to start with @'],
  ];
  const manifestSheet = XLSX.utils.aoa_to_sheet(manifest);
  manifestSheet['!cols'] = [{ wch: 24 }, { wch: 34 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, manifestSheet, MANIFEST_SHEET);
  // Move the manifest to the front.
  workbook.SheetNames = [MANIFEST_SHEET, ...workbook.SheetNames.filter((n) => n !== MANIFEST_SHEET)];

  const safeLabel = range.label.replace(/[^a-zA-Z0-9]+/g, '-');
  const filename = `SwethasCouture-backup-${safeLabel}-${generatedAt.toISOString().split('T')[0]}.xlsx`;
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  );

  return { filename, totalRows, perCollection, range, generatedAt };
}

/* ------------------------------------------------------------------- restore */

export interface RestorePreview {
  formatVersion: number | null;
  generatedAt: string | null;
  period: string | null;
  sheets: { sheet: string; collection: string; label: string; rows: number }[];
  totalRows: number;
  unknownSheets: string[];
}

export interface RestoreProgress {
  collection: string;
  written: number;
  total: number;
}

export interface RestoreResult {
  written: number;
  skipped: number;
  perCollection: { name: string; written: number }[];
  errors: string[];
}

function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(XLSX.read(reader.result, { type: 'array' }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsArrayBuffer(file);
  });
}

/** Reads a backup file and reports what it would restore, without writing anything. */
export async function inspectBackup(file: File): Promise<RestorePreview> {
  const workbook = await readWorkbook(file);
  const bySheet = new Map(BACKUP_COLLECTIONS.map((spec) => [spec.sheet.slice(0, 31), spec]));

  let formatVersion: number | null = null;
  let generatedAt: string | null = null;
  let period: string | null = null;

  if (workbook.SheetNames.includes(MANIFEST_SHEET)) {
    const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[MANIFEST_SHEET], { header: 1 });
    rows.forEach((row) => {
      if (row[0] === 'Format version') formatVersion = Number(row[1]);
      if (row[0] === 'Generated at (local)') generatedAt = String(row[1]);
      if (row[0] === 'Period') period = String(row[1]);
    });
  }

  const sheets: RestorePreview['sheets'] = [];
  const unknownSheets: string[] = [];
  let totalRows = 0;

  workbook.SheetNames.forEach((sheetName) => {
    // `_manifest` and `_media` are documentation, not data to write back.
    if (sheetName === MANIFEST_SHEET || sheetName === MEDIA_SHEET) return;
    const spec = bySheet.get(sheetName);
    if (!spec) {
      unknownSheets.push(sheetName);
      return;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);
    const usable = rows.filter((row) => row.__id);
    sheets.push({ sheet: sheetName, collection: spec.name, label: spec.label, rows: usable.length });
    totalRows += usable.length;
  });

  return { formatVersion, generatedAt, period, sheets, totalRows, unknownSheets };
}

/**
 * Writes a backup file back into Firestore.
 *
 * Documents are restored under their original ids, so re-importing the same file twice is
 * harmless — it overwrites the same documents rather than creating duplicates. That
 * idempotency is what makes "import it into a brand-new Firebase project" safe to retry.
 *
 * `merge` keeps any fields the live document has that the backup does not (safer for a
 * partial/monthly file); turning it off makes each document exactly match the backup.
 */
export async function restoreBackup(
  file: File,
  options: { merge: boolean; onlyCollections?: string[] },
  onProgress?: (progress: RestoreProgress) => void
): Promise<RestoreResult> {
  const workbook = await readWorkbook(file);
  const bySheet = new Map(BACKUP_COLLECTIONS.map((spec) => [spec.sheet.slice(0, 31), spec]));

  const result: RestoreResult = { written: 0, skipped: 0, perCollection: [], errors: [] };
  const BATCH_LIMIT = 400;

  for (const sheetName of workbook.SheetNames) {
    if (sheetName === MANIFEST_SHEET || sheetName === MEDIA_SHEET) continue;
    const spec = bySheet.get(sheetName);
    if (!spec) continue;
    if (options.onlyCollections && !options.onlyCollections.includes(spec.name)) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);
    let written = 0;
    let pending: { id: string; data: Record<string, any> }[] = [];

    const flush = async () => {
      if (pending.length === 0) return;
      const batch = writeBatch(db);
      pending.forEach((item) => {
        batch.set(doc(db, spec.name, item.id), item.data, { merge: options.merge });
      });
      await batch.commit();
      written += pending.length;
      result.written += pending.length;
      onProgress?.({ collection: spec.label, written, total: rows.length });
      pending = [];
    };

    try {
      for (const row of rows) {
        const id = row.__id ? String(row.__id) : '';
        if (!id) {
          result.skipped += 1;
          continue;
        }

        const data: Record<string, any> = {};
        Object.entries(row).forEach(([key, value]) => {
          if (key === '__id' || key === '__error') return;
          // A blank cell means the original document simply did not have this field —
          // writing it back as null would invent data that never existed.
          if (value === undefined || value === null || value === '') return;
          const decoded = decodeValue(value);
          data[key] = decoded === undefined ? null : decoded;
        });

        pending.push({ id, data });
        if (pending.length >= BATCH_LIMIT) await flush();
      }
      await flush();
    } catch (error) {
      const message = `${spec.label}: ${error instanceof Error ? error.message : String(error)}`;
      console.error('Restore failed for', spec.name, error);
      result.errors.push(message);
    }

    result.perCollection.push({ name: spec.name, written });
  }

  return result;
}
