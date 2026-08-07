/**
 * Pulls punches from BioTime Cloud (via the /api/biotime proxy) and folds them into
 * one attendance record per employee per day.
 *
 * Runs in the browser, but never sees BioTime credentials — the serverless proxy holds
 * those and returns only punch data.
 */
import {
  fetchConnection,
  fetchEmployees,
  fetchExistingRecordMap,
  fetchSyncState,
  saveSyncState,
  writeRecordsBatch,
  EMPLOYEES_COLLECTION,
} from './attendanceStore';
import { hoursBetween, toDateKey } from './salaryCalc';
import type { AttendanceRecord, SyncOutcome } from './types';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

/** Re-pull this many days before the last sync — devices upload punches late. */
const OVERLAP_DAYS = 2;
/** How far back the very first sync reaches. */
const FIRST_RUN_DAYS = 60;

interface RawPunch {
  id: string;
  empCode: string;
  empName: string;
  punchTime: string;
  punchState: string;
  terminal: string;
}

export interface BiotimeStatus {
  configured: boolean;
  connected?: boolean;
  error?: string;
  message?: string;
}

/** Formats a Date as BioTime expects: 'YYYY-MM-DD HH:mm:ss' local time. */
function toBiotimeTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Builds request headers for a proxy call: the caller's Firebase ID token (the proxy
 * refuses anonymous requests) plus the admin-supplied BioTime connection, if saved.
 *
 * Headers rather than query params so neither token can end up in an access log or
 * browser history.
 */
async function proxyHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const connection = await fetchConnection().catch(() => null);
  if (connection) {
    if (connection.baseUrl) headers['x-biotime-base-url'] = connection.baseUrl;
    if (connection.token) headers['x-biotime-token'] = connection.token;
    if (connection.authScheme) headers['x-biotime-scheme'] = connection.authScheme;
  }

  return headers;
}

export async function checkBiotimeStatus(): Promise<BiotimeStatus> {
  try {
    const res = await fetch('/api/biotime?action=status', {
      headers: await proxyHeaders(),
    });
    return (await res.json()) as BiotimeStatus;
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : 'Could not reach the BioTime proxy.',
    };
  }
}

/**
 * Splits 'YYYY-MM-DD HH:mm:ss' (also tolerating an ISO 'T' separator) into date and
 * time parts. Deliberately string-based: parsing to a Date and back would apply a
 * timezone shift and could move a late-evening checkout onto the wrong day.
 */
function splitPunchTime(punchTime: string): { date: string; time: string } | null {
  const normalised = punchTime.trim().replace('T', ' ');
  const [datePart, timePart] = normalised.split(' ');
  if (!datePart || !timePart) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const [hh, mm] = timePart.split(':');
  if (hh === undefined || mm === undefined) return null;
  return { date: datePart, time: `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}` };
}

/**
 * Folds punches into day records.
 *
 * check-in = earliest punch of the day, check-out = latest. Naive in-out pairing would
 * break on the common lunch-break pattern (in, out, in, out) by dropping the afternoon;
 * first/last is correct for that and for a simple two-punch day alike.
 */
export function foldPunchesIntoRecords(
  punches: RawPunch[],
  nameLookup: Map<string, string>
): Omit<AttendanceRecord, 'id'>[] {
  const byEmployeeDay = new Map<string, { empCode: string; date: string; times: string[] }>();

  for (const punch of punches) {
    const parts = splitPunchTime(punch.punchTime);
    if (!parts) continue;

    const key = `${punch.empCode}_${parts.date}`;
    const entry = byEmployeeDay.get(key) || {
      empCode: punch.empCode,
      date: parts.date,
      times: [],
    };
    entry.times.push(parts.time);
    byEmployeeDay.set(key, entry);
  }

  const records: Omit<AttendanceRecord, 'id'>[] = [];

  for (const entry of byEmployeeDay.values()) {
    const sorted = [...entry.times].sort();
    const checkIn = sorted[0];
    // A single punch in a day is a check-in with no check-out, not a zero-length shift.
    const checkOut = sorted.length > 1 ? sorted[sorted.length - 1] : undefined;

    records.push({
      empCode: entry.empCode,
      employeeName: nameLookup.get(entry.empCode) || entry.empCode,
      date: entry.date,
      checkIn,
      checkOut: checkOut || '',
      hoursWorked: hoursBetween(checkIn, checkOut),
      status: checkOut ? 'present' : 'incomplete',
      punches: sorted,
      source: 'biotime',
      manuallyEdited: false,
      createdAt: new Date().toISOString(),
    });
  }

  return records;
}

/**
 * One sync run: fetch punches, auto-create any unseen employee, write day records,
 * update the watermark.
 */
export async function syncFromBiotime(): Promise<SyncOutcome> {
  const state = await fetchSyncState();

  const end = new Date();
  const start = new Date();
  if (state.lastSyncedAt) {
    start.setTime(new Date(state.lastSyncedAt).getTime());
    start.setDate(start.getDate() - OVERLAP_DAYS);
  } else {
    start.setDate(start.getDate() - FIRST_RUN_DAYS);
  }
  start.setHours(0, 0, 0, 0);

  const url =
    `/api/biotime?action=transactions` +
    `&start=${encodeURIComponent(toBiotimeTime(start))}` +
    `&end=${encodeURIComponent(toBiotimeTime(end))}`;

  let payload: { configured: boolean; punches?: RawPunch[]; error?: string; message?: string };
  try {
    const res = await fetch(url, { headers: await proxyHeaders() });
    payload = await res.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error contacting the proxy.';
    await saveSyncState({ lastRunAt: new Date().toISOString(), lastRunStatus: 'error', lastError: message });
    return { status: 'error', punches: 0, daysWritten: 0, employeesCreated: 0, message };
  }

  if (!payload.configured) {
    await saveSyncState({ lastRunAt: new Date().toISOString(), lastRunStatus: 'not_configured' });
    return {
      status: 'not_configured',
      punches: 0,
      daysWritten: 0,
      employeesCreated: 0,
      message: payload.message,
    };
  }

  if (payload.error) {
    await saveSyncState({
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'error',
      lastError: payload.error,
    });
    return { status: 'error', punches: 0, daysWritten: 0, employeesCreated: 0, message: payload.error };
  }

  const punches = payload.punches || [];

  // No punches is a perfectly normal result (nobody worked, or the device is not yet
  // registered). Move the watermark so the next run does not re-scan the same window.
  if (punches.length === 0) {
    await saveSyncState({
      lastSyncedAt: end.toISOString(),
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'success',
      lastError: '',
      punchesImported: 0,
    });
    return { status: 'success', punches: 0, daysWritten: 0, employeesCreated: 0 };
  }

  const knownEmployees = await fetchEmployees();
  const nameLookup = new Map(knownEmployees.map((employee) => [employee.empCode, employee.name]));
  const knownCodes = new Set(knownEmployees.map((employee) => employee.empCode));

  // "All the unique users get into the platform when they first give the fingerprint":
  // any emp_code we have not seen before becomes an employee awaiting salary setup.
  const newCodes = new Map<string, string>();
  for (const punch of punches) {
    if (!knownCodes.has(punch.empCode) && !newCodes.has(punch.empCode)) {
      newCodes.set(punch.empCode, punch.empName || punch.empCode);
    }
  }

  if (newCodes.size > 0) {
    const batch = writeBatch(db);
    const timestamp = new Date().toISOString();
    for (const [empCode, name] of newCodes) {
      batch.set(
        doc(collection(db, EMPLOYEES_COLLECTION), empCode),
        {
          empCode,
          name,
          salaryMode: null,
          salaryAmount: 0,
          standardHoursPerDay: 8,
          active: true,
          source: 'biotime',
          firstSeenAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        { merge: true }
      );
      nameLookup.set(empCode, name);
    }
    await batch.commit();
  }

  const records = foldPunchesIntoRecords(punches, nameLookup);

  const dates = records.map((record) => record.date).sort();
  const existing = dates.length
    ? await fetchExistingRecordMap(dates[0], dates[dates.length - 1])
    : new Map<string, AttendanceRecord>();

  const daysWritten = await writeRecordsBatch(records, existing);

  await saveSyncState({
    lastSyncedAt: end.toISOString(),
    lastRunAt: new Date().toISOString(),
    lastRunStatus: 'success',
    lastError: '',
    punchesImported: punches.length,
    employeesCreated: newCodes.size,
  });

  return {
    status: 'success',
    punches: punches.length,
    daysWritten,
    employeesCreated: newCodes.size,
  };
}

/** Today's date key, used as the default for manual entry. */
export const todayKey = () => toDateKey(new Date());
