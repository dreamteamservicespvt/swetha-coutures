/**
 * Firestore access for the attendance module.
 *
 * Collections used (all new — nothing existing is touched):
 *   attendanceEmployees  doc id = empCode
 *   attendanceRecords    doc id = `${empCode}_${date}`
 *   salaryPayments       doc id = `${empCode}_${periodKey}`
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { hoursBetween } from './salaryCalc';
import type {
  AttendanceEmployee,
  AttendanceRecord,
  SalaryPayment,
  SalaryMode,
} from './types';

export const EMPLOYEES_COLLECTION = 'attendanceEmployees';
export const RECORDS_COLLECTION = 'attendanceRecords';
export const PAYMENTS_COLLECTION = 'salaryPayments';

/** Firestore rejects a batch over 500 writes; 400 leaves room for the sync-state write. */
const BATCH_LIMIT = 400;

const nowIso = () => new Date().toISOString();

/** Doc ID for a day record. Deterministic — this is what makes sync idempotent. */
export const recordId = (empCode: string, date: string) => `${empCode}_${date}`;

/** Doc ID for a month's payment. */
export const paymentId = (empCode: string, periodKey: string) => `${empCode}_${periodKey}`;

/* ------------------------------------------------------------------ employees */

export async function fetchEmployees(): Promise<AttendanceEmployee[]> {
  const snapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
  return snapshot.docs
    .map((snap) => ({ id: snap.id, ...snap.data() }) as AttendanceEmployee)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function saveEmployee(
  empCode: string,
  data: Partial<AttendanceEmployee>
): Promise<void> {
  await setDoc(
    doc(db, EMPLOYEES_COLLECTION, empCode),
    { ...data, empCode, updatedAt: nowIso() },
    { merge: true }
  );
}

export async function createManualEmployee(input: {
  empCode: string;
  name: string;
  department?: string;
  salaryMode: SalaryMode | null;
  salaryAmount: number;
  standardHoursPerDay: number;
}): Promise<void> {
  const existing = await getDoc(doc(db, EMPLOYEES_COLLECTION, input.empCode));
  if (existing.exists()) {
    throw new Error(`Employee code "${input.empCode}" already exists.`);
  }
  await setDoc(doc(db, EMPLOYEES_COLLECTION, input.empCode), {
    ...input,
    active: true,
    source: 'manual',
    firstSeenAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function deleteEmployee(empCode: string): Promise<void> {
  await deleteDoc(doc(db, EMPLOYEES_COLLECTION, empCode));
}

/* -------------------------------------------------------------------- records */

/**
 * Records within a date range. Dates are 'YYYY-MM-DD' strings, which sort
 * lexicographically in the same order as chronologically, so range queries work
 * directly on the string field without a separate timestamp.
 */
export async function fetchRecords(
  startDate?: string,
  endDate?: string
): Promise<AttendanceRecord[]> {
  const constraints = [];
  if (startDate) constraints.push(where('date', '>=', startDate));
  if (endDate) constraints.push(where('date', '<=', endDate));

  const snapshot = await getDocs(
    constraints.length
      ? query(collection(db, RECORDS_COLLECTION), ...constraints, orderBy('date', 'desc'))
      : query(collection(db, RECORDS_COLLECTION), orderBy('date', 'desc'))
  );

  return snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }) as AttendanceRecord);
}

/**
 * Writes or corrects one day by hand. Marks the record `manuallyEdited` so a later
 * sync will not silently revert the admin's correction.
 */
export async function saveRecordManually(input: {
  empCode: string;
  employeeName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
}): Promise<void> {
  const id = recordId(input.empCode, input.date);
  const hoursWorked = hoursBetween(input.checkIn, input.checkOut);

  await setDoc(
    doc(db, RECORDS_COLLECTION, id),
    {
      empCode: input.empCode,
      employeeName: input.employeeName,
      date: input.date,
      checkIn: input.checkIn || '',
      checkOut: input.checkOut || '',
      hoursWorked,
      status: input.checkOut ? 'present' : 'incomplete',
      source: 'manual',
      manuallyEdited: true,
      updatedAt: nowIso(),
    },
    { merge: true }
  );
}

export async function deleteRecord(id: string): Promise<void> {
  await deleteDoc(doc(db, RECORDS_COLLECTION, id));
}

/**
 * Bulk-writes day records from a sync run, chunked to stay under Firestore's batch limit.
 *
 * Only genuinely changed records are written. The page re-syncs every 60 seconds over a
 * multi-day overlap window, so writing every record every cycle would cost thousands of
 * pointless Firestore writes a day and grow with headcount. Unchanged days are skipped.
 *
 * Records flagged `manuallyEdited` keep their admin-corrected times; only the raw punch
 * audit trail is refreshed, and only if it actually differs.
 */
export async function writeRecordsBatch(
  records: Omit<AttendanceRecord, 'id'>[],
  existing: Map<string, AttendanceRecord>
): Promise<number> {
  const pending: { id: string; data: Record<string, unknown> }[] = [];

  for (const record of records) {
    const id = recordId(record.empCode, record.date);
    const prior = existing.get(id);

    if (prior?.manuallyEdited) {
      const samePunches =
        JSON.stringify(prior.punches || []) === JSON.stringify(record.punches || []);
      if (!samePunches) {
        pending.push({ id, data: { punches: record.punches || [], updatedAt: nowIso() } });
      }
      continue;
    }

    if (
      prior &&
      (prior.checkIn || '') === (record.checkIn || '') &&
      (prior.checkOut || '') === (record.checkOut || '') &&
      (prior.hoursWorked || 0) === (record.hoursWorked || 0) &&
      prior.employeeName === record.employeeName
    ) {
      continue; // Nothing changed for this day.
    }

    pending.push({ id, data: { ...record, updatedAt: nowIso() } });
  }

  for (let offset = 0; offset < pending.length; offset += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const item of pending.slice(offset, offset + BATCH_LIMIT)) {
      batch.set(doc(db, RECORDS_COLLECTION, item.id), item.data, { merge: true });
    }
    await batch.commit();
  }

  return pending.length;
}

/**
 * Existing records in a window, keyed by doc ID. Sync uses this both to skip unchanged
 * days and to recognise the ones an admin has hand-corrected.
 */
export async function fetchExistingRecordMap(
  startDate: string,
  endDate: string
): Promise<Map<string, AttendanceRecord>> {
  const snapshot = await getDocs(
    query(
      collection(db, RECORDS_COLLECTION),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    )
  );

  const map = new Map<string, AttendanceRecord>();
  snapshot.docs.forEach((snap) => {
    map.set(snap.id, { id: snap.id, ...snap.data() } as AttendanceRecord);
  });
  return map;
}

/* ------------------------------------------------------------------- payments */

export async function fetchPayments(periodKey?: string): Promise<SalaryPayment[]> {
  const snapshot = await getDocs(
    periodKey
      ? query(collection(db, PAYMENTS_COLLECTION), where('periodKey', '==', periodKey))
      : collection(db, PAYMENTS_COLLECTION)
  );
  return snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }) as SalaryPayment);
}

export async function markPaid(input: {
  empCode: string;
  employeeName: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  daysWorked: number;
  hoursWorked: number;
  salaryMode: SalaryMode | null;
  paidBy: string;
}): Promise<void> {
  await setDoc(doc(db, PAYMENTS_COLLECTION, paymentId(input.empCode, input.periodKey)), {
    ...input,
    status: 'paid',
    paidAt: nowIso(),
    // Clear any prior revert so the record reads cleanly if re-paid.
    revertedAt: '',
    revertedBy: '',
  });
}

/**
 * Undo. Soft revert rather than delete, so an accidental click and its correction
 * both remain on the record.
 */
export async function undoPayment(empCode: string, periodKey: string, revertedBy: string): Promise<void> {
  await updateDoc(doc(db, PAYMENTS_COLLECTION, paymentId(empCode, periodKey)), {
    status: 'reverted',
    revertedAt: nowIso(),
    revertedBy,
  });
}
