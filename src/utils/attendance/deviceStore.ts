/**
 * Firestore access for the ADMS device feed.
 *
 * The office ZKTeco terminal pushes punches to our own ingest server, which writes them
 * here. The app only ever reads this data and manages device approval — it never talks
 * to the device.
 *
 * Collections:
 *   devices        doc id = serial number
 *   devicePunches  doc id = `${sn}_${userPin}_${YYYYMMDDHHmmss}`
 */
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { foldPunchesIntoRecords } from './punchFolding';
import {
  EMPLOYEES_COLLECTION,
  fetchEmployees,
  fetchExistingRecordMap,
  writeRecordsBatch,
} from './attendanceStore';
import type { AttendanceDevice, DevicePunch } from './types';

export const DEVICES_COLLECTION = 'devices';
export const PUNCHES_COLLECTION = 'devicePunches';
export const RAW_LOGS_COLLECTION = 'deviceRawLogs';

/**
 * A busy shop generates a few hundred punches a month. This cap exists so a runaway
 * device or a very wide date range cannot pull an unbounded read bill.
 */
const PUNCH_READ_LIMIT = 5000;

/** Firestore rejects a batch over 500 writes. */
const BATCH_LIMIT = 400;

const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------- devices */

export async function fetchDevices(): Promise<AttendanceDevice[]> {
  const snapshot = await getDocs(collection(db, DEVICES_COLLECTION));
  return snapshot.docs
    .map((snap) => ({ id: snap.id, ...snap.data() }) as AttendanceDevice)
    .sort((a, b) => (a.name || a.sn || '').localeCompare(b.name || b.sn || ''));
}

export async function renameDevice(sn: string, name: string): Promise<void> {
  await setDoc(doc(db, DEVICES_COLLECTION, sn), { name, updatedAt: nowIso() }, { merge: true });
}

export async function blockDevice(sn: string): Promise<void> {
  await setDoc(
    doc(db, DEVICES_COLLECTION, sn),
    { status: 'blocked', updatedAt: nowIso() },
    { merge: true }
  );
}

/**
 * Approves a device and backfills everything it sent while it was waiting.
 *
 * Punches that arrived before approval are stored but flagged `parked` and kept out of
 * payroll. Without this backfill, every punch between plugging the device in and clicking
 * Approve would be lost — which is precisely the window in which someone is standing at
 * the machine testing whether it works.
 */
export async function approveDevice(
  sn: string,
  approvedBy: string
): Promise<{ punchesBackfilled: number; daysWritten: number; employeesCreated: number }> {
  await setDoc(
    doc(db, DEVICES_COLLECTION, sn),
    { status: 'approved', approvedAt: nowIso(), approvedBy, updatedAt: nowIso() },
    { merge: true }
  );

  return backfillParkedPunches(sn);
}

/* ------------------------------------------------------------------- punches */

/**
 * Punches in a date range.
 *
 * `punchDate` is a 'YYYY-MM-DD' string, which sorts lexicographically in the same order
 * as chronologically, so a range query works directly on it without a second timestamp
 * field. Employee filtering is done in the component rather than here — adding a second
 * field to the query would require a composite index for no real gain at this volume.
 */
export async function fetchPunches(
  startDate?: string,
  endDate?: string
): Promise<DevicePunch[]> {
  const constraints = [];
  if (startDate) constraints.push(where('punchDate', '>=', startDate));
  if (endDate) constraints.push(where('punchDate', '<=', endDate));

  const snapshot = await getDocs(
    query(
      collection(db, PUNCHES_COLLECTION),
      ...constraints,
      orderBy('punchDate', 'desc'),
      limit(PUNCH_READ_LIMIT)
    )
  );

  return snapshot.docs
    .map((snap) => ({ id: snap.id, ...snap.data() }) as DevicePunch)
    // Firestore can only order by the range field, so the within-day ordering is done here.
    .sort((a, b) => (b.punchTimeLocal || '').localeCompare(a.punchTimeLocal || ''));
}

/**
 * Turns a device's parked punches into real attendance.
 *
 * Reuses `foldPunchesIntoRecords` + `writeRecordsBatch`, so there is exactly one
 * definition in the app of what a day record means — first punch in, last punch out,
 * hand-edited records left alone.
 */
export async function backfillParkedPunches(
  sn: string
): Promise<{ punchesBackfilled: number; daysWritten: number; employeesCreated: number }> {
  const snapshot = await getDocs(
    query(
      collection(db, PUNCHES_COLLECTION),
      where('deviceSn', '==', sn),
      where('parked', '==', true),
      limit(PUNCH_READ_LIMIT)
    )
  );

  const parked = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }) as DevicePunch);
  if (parked.length === 0) return { punchesBackfilled: 0, daysWritten: 0, employeesCreated: 0 };

  const known = await fetchEmployees();
  const nameLookup = new Map(known.map((employee) => [employee.empCode, employee.name]));
  const knownCodes = new Set(known.map((employee) => employee.empCode));

  // Anyone whose PIN we have not seen becomes an employee awaiting salary setup — the
  // same rule the device feed applies for an approved device.
  const newCodes = new Map<string, string>();
  for (const punch of parked) {
    if (!knownCodes.has(punch.userPin) && !newCodes.has(punch.userPin)) {
      newCodes.set(punch.userPin, punch.employeeName || punch.userPin);
    }
  }

  if (newCodes.size > 0) {
    const batch = writeBatch(db);
    const timestamp = nowIso();
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
          source: 'device',
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

  const records = foldPunchesIntoRecords(
    parked.map((punch) => ({
      id: punch.id,
      empCode: punch.userPin,
      empName: punch.employeeName || punch.userPin,
      punchTime: punch.punchTimeLocal,
      punchState: punch.punchState || '0',
      terminal: punch.deviceSn,
    })),
    nameLookup
  ).map((record) => ({ ...record, source: 'device' as const }));

  const dates = records.map((record) => record.date).sort();
  const existing = dates.length
    ? await fetchExistingRecordMap(dates[0], dates[dates.length - 1])
    : new Map();

  const daysWritten = await writeRecordsBatch(records, existing);

  // Clear the flag last: if anything above threw, the punches stay parked and the
  // backfill can simply be run again rather than being half-applied and forgotten.
  for (let offset = 0; offset < parked.length; offset += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const punch of parked.slice(offset, offset + BATCH_LIMIT)) {
      batch.set(doc(db, PUNCHES_COLLECTION, punch.id), { parked: false }, { merge: true });
    }
    await batch.commit();
  }

  return {
    punchesBackfilled: parked.length,
    daysWritten,
    employeesCreated: newCodes.size,
  };
}

/* -------------------------------------------------------------------- health */

export type DeviceHealth = 'healthy' | 'stale' | 'waiting' | 'pending' | 'blocked' | 'none';

export interface DeviceHealthSummary {
  health: DeviceHealth;
  /** The device the headline refers to — the most recently heard-from approved one. */
  device?: AttendanceDevice;
  pending: AttendanceDevice[];
  minutesSinceSeen?: number;
}

/**
 * Reduces the device list to one headline state.
 *
 * A silently dead device is the failure mode that actually costs money here — nobody
 * notices until payroll. The terminal polls for commands roughly every 30 seconds even
 * when nobody punches, so `lastSeenAt` going quiet is meaningful on its own and does not
 * wait for someone to turn up for work.
 */
export function summariseDeviceHealth(
  devices: AttendanceDevice[],
  staleMinutes: number
): DeviceHealthSummary {
  const pending = devices.filter((device) => device.status === 'pending');
  const approved = devices.filter((device) => device.status === 'approved');

  if (approved.length === 0) {
    if (pending.length > 0) return { health: 'pending', pending };
    const blocked = devices.filter((device) => device.status === 'blocked');
    if (blocked.length > 0) return { health: 'blocked', pending, device: blocked[0] };
    return { health: 'none', pending };
  }

  const mostRecent = [...approved].sort((a, b) =>
    (b.lastSeenAt || '').localeCompare(a.lastSeenAt || '')
  )[0];

  /**
   * A device registered in advance that has never once made contact is a different
   * situation from one that was working and went quiet. "Stopped reporting" would send
   * someone to check a power cable when the real problem is the address typed into the
   * terminal's menu.
   */
  if (!mostRecent.lastSeenAt) {
    return { health: 'waiting', device: mostRecent, pending };
  }

  const seenAt = mostRecent.lastSeenAt ? new Date(mostRecent.lastSeenAt).getTime() : NaN;
  const minutesSinceSeen = Number.isNaN(seenAt)
    ? undefined
    : Math.floor((Date.now() - seenAt) / 60000);

  const stale = minutesSinceSeen === undefined || minutesSinceSeen >= staleMinutes;

  return {
    health: stale ? 'stale' : 'healthy',
    device: mostRecent,
    pending,
    minutesSinceSeen,
  };
}
