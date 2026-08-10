/**
 * Turning raw punches into day records.
 *
 * The folding rule is what the app means by "a day of attendance": the device backfill
 * and the Records tab both depend on it agreeing exactly.
 *
 * The same rule is implemented in api/_deviceIngest.ts for the serverless path. That
 * duplication is deliberate: the api/ module must stay import-free so it can run in Vercel,
 * the Vite dev server and the test simulator alike. Change both together.
 */
import type { AttendanceRecord } from './types';

/** 'YYYY-MM-DD' for a date, in local time — matching how punch dates are stored. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const todayKey = () => toDateKey(new Date());

/** Minutes between two 'HH:mm' times, as decimal hours. */
function hoursBetween(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const [inHour, inMinute] = checkIn.split(':').map(Number);
  const [outHour, outMinute] = checkOut.split(':').map(Number);
  if ([inHour, inMinute, outHour, outMinute].some((part) => Number.isNaN(part))) return 0;

  let minutes = outHour * 60 + outMinute - (inHour * 60 + inMinute);
  // A checkout earlier than the check-in means the shift crossed midnight.
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

/** Splits 'YYYY-MM-DD HH:mm:ss' into its date and 'HH:mm' parts. */
function splitPunchTime(value: string): { date: string; time: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(String(value || '').trim());
  if (!match) return null;
  return { date: match[1], time: `${match[2]}:${match[3]}` };
}

export interface RawPunch {
  id: string;
  empCode: string;
  empName: string;
  punchTime: string;
  punchState: string;
  terminal: string;
}

/**
 * Collapses punches into one record per employee per day.
 *
 * check-in = earliest punch, check-out = latest. Naive in/out pairing breaks on the
 * ordinary lunch-break pattern (in, out, in, out) by dropping the afternoon; first/last is
 * correct for that and for a simple two-punch day alike.
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
    const entry = byEmployeeDay.get(key) || { empCode: punch.empCode, date: parts.date, times: [] };
    entry.times.push(parts.time);
    byEmployeeDay.set(key, entry);
  }

  const records: Omit<AttendanceRecord, 'id'>[] = [];

  for (const entry of byEmployeeDay.values()) {
    const sorted = [...new Set(entry.times)].sort();
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
      source: 'device',
      manuallyEdited: false,
      createdAt: new Date().toISOString(),
    });
  }

  return records;
}
