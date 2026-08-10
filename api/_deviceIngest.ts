/**
 * ZKTeco ADMS protocol + ingest logic — SERVER SIDE ONLY.
 *
 * Deliberately self-contained: no imports at all. That is what lets the same code run in
 * three places without a build step — the Vercel serverless function, the Vite dev server
 * (so the device can be tested over the office LAN), and the simulator in
 * scripts/simulate-device.ts. The database is injected as a `DocStore`, so the simulator
 * can exercise every path against an in-memory store with no Firebase project at all.
 *
 * The device is an unforgiving HTTP client: it reads the response *body* literally, ignores
 * JSON entirely, and treats anything it does not understand as a failure it must retry
 * forever. Every rule below that looks strange exists because of that.
 */

/* ------------------------------------------------------------------ collections */

export const COLLECTIONS = {
  devices: 'devices',
  punches: 'devicePunches',
  rawLogs: 'deviceRawLogs',
  employees: 'attendanceEmployees',
  records: 'attendanceRecords',
} as const;

/* ---------------------------------------------------------------------- types */

export type DocData = Record<string, unknown>;

/** The minimal database surface this module needs. */
export interface DocStore {
  get(collection: string, id: string): Promise<DocData | null>;
  getMany(collection: string, ids: string[]): Promise<Map<string, DocData>>;
  setMany(collection: string, entries: { id: string; data: DocData }[]): Promise<number>;
  set(collection: string, id: string, data: DocData): Promise<void>;
}

export interface IngestConfig {
  /** Minutes east of UTC that the device's clock is set to. India = 330. */
  timezoneOffsetMinutes: number;
  /** Trust any device that connects. Off by default; approve in the app instead. */
  autoApproveDevices: boolean;
  /** 'data' logs uploads only, 'all' also logs the ~30s command polls, 'off' logs nothing. */
  rawLogMode: 'data' | 'all' | 'off';
  rawLogMaxBytes: number;
  rawLogRetentionDays: number;
  /** Optional serial-number allowlist. Empty = accept any device (then quarantine it). */
  deviceSerials: string[];
}

export interface DeviceRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  /** Already decoded to text by the adapter. */
  body: string;
  bodyBytes: number;
  headers: Record<string, string>;
  remoteAddress: string;
}

export interface DeviceResponse {
  status: number;
  body: string;
  /** Short line for the server log. */
  log: string;
}

export function defaultConfig(env: Record<string, string | undefined> = {}): IngestConfig {
  const offset = /^([+-])(\d{2}):?(\d{2})$/.exec((env.DEVICE_TZ_OFFSET || '+05:30').trim());
  const minutes = offset
    ? (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3]))
    : 330;

  const rawMode = (env.RAW_LOG_MODE || 'data').trim().toLowerCase();

  return {
    timezoneOffsetMinutes: minutes,
    autoApproveDevices: /^(1|true|yes|on)$/i.test(String(env.AUTO_APPROVE_DEVICES || '')),
    rawLogMode: rawMode === 'all' || rawMode === 'off' ? rawMode : 'data',
    rawLogMaxBytes: Number(env.RAW_LOG_MAX_BYTES) || 16 * 1024,
    rawLogRetentionDays: Number(env.RAW_LOG_RETENTION_DAYS) || 14,
    deviceSerials: (env.DEVICE_SERIALS || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}

/* ------------------------------------------------------------------- protocol */

/**
 * Decodes a raw body without trusting the device's declared charset.
 *
 * These terminals routinely send a wrong or absent Content-Type and a Content-Length that
 * does not match the bytes. UTF-8 is tried first and falls back to latin1, which cannot
 * throw and preserves the tab-separated numeric data we actually want.
 */
export function decodeBody(buffer: Buffer): string {
  if (!buffer || buffer.length === 0) return '';
  const utf8 = buffer.toString('utf8');
  return utf8.includes('�') ? buffer.toString('latin1') : utf8;
}

/** Splits an upload body into rows, tolerating \r\n, \n and bare \r. */
export function splitRows(body: string): string[] {
  return String(body || '')
    .split(/\r\n|\n|\r/)
    .map((row) => row.replace(/\s+$/, ''))
    .filter((row) => row.length > 0);
}

/** Splits a key=value row (USERINFO and friends). */
export function splitFields(row: string): string[] {
  if (row.includes('\t')) return row.split('\t');
  return row.trim().split(/ {1,}/);
}

/**
 * Splits one ATTLOG row into fields.
 *
 * ATTLOG cannot use the generic splitter for its space fallback, because its second field
 * is a timestamp that *contains a space*. Splitting `1003 2026-08-09 10:00:00 0 1` on
 * whitespace tears the date from the time, and the row is dropped as malformed — a silent
 * loss of a real punch. So the fallback matches the timestamp as a unit.
 */
export function splitAttlogRow(row: string): string[] {
  if (row.includes('\t')) return row.split('\t');

  const spaced =
    /^(\S+)[ \t]+(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)(?:[ \t]+(\S+))?(?:[ \t]+(\S+))?/.exec(
      row.trim()
    );

  if (spaced) return [spaced[1], spaced[2], spaced[3] ?? '', spaced[4] ?? ''];
  return row.trim().split(/ {1,}/);
}

export interface NormalisedTime {
  /** 'YYYY-MM-DD HH:mm:ss' */
  local: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:mm' */
  time: string;
  /** 'YYYYMMDDHHmmss' — used in the punch document ID. */
  compact: string;
}

/** Validates and normalises a device timestamp. Returns null for anything unparseable. */
export function normaliseTimestamp(raw: string): NormalisedTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    String(raw || '').trim()
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second = '00'] = match;

  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;

  // Reject impossible dates rather than letting Date silently roll them over —
  // '2026-02-31' quietly becoming 3 March would be a wrong attendance day.
  const probe = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    probe.getUTCFullYear() !== Number(year) ||
    probe.getUTCMonth() !== Number(month) - 1 ||
    probe.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return {
    local: `${year}-${month}-${day} ${hour}:${minute}:${second}`,
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    compact: `${year}${month}${day}${hour}${minute}${second}`,
  };
}

/**
 * Converts the device's naive local wall-clock to a UTC instant.
 *
 * Done by arithmetic on the parsed parts rather than `new Date(string)`, which would apply
 * the *server's* timezone — and Vercel runs in UTC, so every punch would land 5.5 hours out.
 */
export function toUtcIso(time: NormalisedTime, offsetMinutes: number): string {
  const [datePart, timePart] = time.local.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60000
  ).toISOString();
}

export interface AttlogRow {
  userPin: string;
  raw: string;
  timestampRaw: string;
  normalised: NormalisedTime;
  punchState: string;
  verifyMode: string;
  workCode: string;
}

/**
 * Parses an ATTLOG upload.
 * `user_pin, timestamp, punch_state, verify_mode, work_code, reserved, reserved`
 *
 * A bad row is skipped and counted, never thrown. Rejecting the whole upload would make the
 * device replay it forever, so one corrupt row would block every good punch behind it.
 */
export function parseAttlog(body: string): {
  rows: AttlogRow[];
  skipped: { line: number; raw: string; reason: string }[];
} {
  const rows: AttlogRow[] = [];
  const skipped: { line: number; raw: string; reason: string }[] = [];

  splitRows(body).forEach((line, index) => {
    const [pin, timestamp, punchState = '', verifyMode = '', workCode = ''] =
      splitAttlogRow(line);

    if (!pin || !timestamp) {
      skipped.push({ line: index + 1, raw: line, reason: 'missing user pin or timestamp' });
      return;
    }

    const normalised = normaliseTimestamp(timestamp);
    if (!normalised) {
      skipped.push({ line: index + 1, raw: line, reason: `unparseable timestamp "${timestamp}"` });
      return;
    }

    rows.push({
      userPin: String(pin).trim(),
      raw: line,
      timestampRaw: String(timestamp).trim(),
      normalised,
      punchState: String(punchState).trim(),
      verifyMode: String(verifyMode).trim(),
      workCode: String(workCode).trim(),
    });
  });

  return { rows, skipped };
}

/**
 * Parses a USERINFO upload — `PIN=1<TAB>Name=Asha<TAB>...` per row.
 *
 * Only the PIN and name are taken. Fingerprint templates, passwords and card numbers are
 * deliberately never stored: we want the punch event, and biometrics stay on the device.
 */
export function parseUserInfo(body: string): { pin: string; name: string }[] {
  const entries: { pin: string; name: string }[] = [];

  for (const line of splitRows(body)) {
    const pairs: Record<string, string> = {};
    for (const field of splitFields(line)) {
      const separator = field.indexOf('=');
      if (separator <= 0) continue;
      pairs[field.slice(0, separator).trim().toLowerCase()] = field.slice(separator + 1).trim();
    }
    if (pairs.pin) entries.push({ pin: pairs.pin, name: pairs.name || '' });
  }

  return entries;
}

const PUNCH_STATE_LABELS: Record<number, string> = {
  0: 'Check in',
  1: 'Check out',
  2: 'Break out',
  3: 'Break in',
  4: 'Overtime in',
  5: 'Overtime out',
};

export function punchStateLabel(state: string): string {
  return PUNCH_STATE_LABELS[Number.parseInt(String(state ?? '').trim(), 10)] || 'Punch';
}

/**
 * The boot handshake reply.
 *
 * Not JSON and not free-form: a `GET OPTION FROM: <SN>` header followed by key=value lines.
 * This is what tells the device how to behave — how often to talk to us, what it may upload,
 * and that we want realtime delivery rather than batching. `Stamp=0` asks it to send
 * everything it holds, so a device that buffered while we were unreachable flushes on
 * reconnect.
 */
export function buildHandshakeResponse(serialNumber: string, config: IngestConfig): string {
  return [
    `GET OPTION FROM: ${serialNumber}`,
    'Stamp=0',
    'OpStamp=0',
    'ErrorDelay=30',
    'Delay=30',
    'TransTimes=00:00;14:05',
    'TransInterval=1',
    // Which tables the device may push: attendance, operation log, user info, fingerprint.
    'TransFlag=1111000000',
    `TimeZone=${config.timezoneOffsetMinutes / 60}`,
    'Realtime=1',
    'Encrypt=0',
    'ATTLOGStamp=0',
    'OPERLOGStamp=0',
    'ATTPHOTOStamp=0',
    '',
  ].join('\n');
}

/**
 * PushSDK 2.x registration reply.
 *
 * Firmware with a "Push Service 2.x" build (this shop's K40 Pro reports 2.0.33S) may call
 * `/iclock/registry` before anything else and refuse to continue without a RegistryCode.
 * The code is server-assigned and opaque to us, so the serial itself is a fine value.
 */
export function buildRegistryResponse(serialNumber: string): string {
  return `RegistryCode=${serialNumber}\n`;
}

/**
 * PushSDK 2.x configuration reply for `/iclock/push`.
 *
 * The 2.x handshake asks for its operating parameters here rather than in the `cdata`
 * GET. `TransTables=User Transaction` is what subscribes us to attendance records;
 * without it the device connects happily and then never sends a punch.
 */
export function buildPushConfigResponse(serialNumber: string, config: IngestConfig): string {
  return [
    `registry=ok`,
    `RegistryCode=${serialNumber}`,
    `ServerVersion=2.4.1`,
    `ServerName=ADMS`,
    `PushProtVer=2.4.1`,
    `ErrorDelay=30`,
    `RequestDelay=10`,
    `TransTimes=00:00;14:05`,
    `TransInterval=1`,
    `TransTables=User Transaction`,
    `Realtime=1`,
    `SessionID=${serialNumber}`,
    `TimeoutSec=10`,
    `TimeZone=${config.timezoneOffsetMinutes / 60}`,
    '',
  ].join('\n');
}

/* --------------------------------------------------------------------- helpers */

const nowIso = () => new Date().toISOString();

/** Firestore document IDs may not contain '/' and may not be '.' or '..'. */
export function safeId(value: string): string {
  return String(value ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '_') || 'unknown';
}

/**
 * Decimal hours between two 'HH:mm' times.
 * Must stay in step with `hoursBetween` in src/utils/attendance/salaryCalc.ts.
 */
export function hoursBetween(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const [inHour, inMinute] = checkIn.split(':').map(Number);
  const [outHour, outMinute] = checkOut.split(':').map(Number);
  if ([inHour, inMinute, outHour, outMinute].some((part) => Number.isNaN(part))) return 0;

  let minutes = outHour * 60 + outMinute - (inHour * 60 + inMinute);
  if (minutes < 0) minutes += 24 * 60; // shift crossed midnight
  return Math.round((minutes / 60) * 100) / 100;
}

/* --------------------------------------------------------------------- devices */

export interface DeviceState {
  id: string;
  status: string;
  punchCount: number;
  isNew: boolean;
}

/**
 * Records that we heard from a device, and returns its current state.
 *
 * An unknown serial is created as `pending`, not rejected. The endpoint is public — the
 * device cannot authenticate — so an allowlist is needed, but demanding the serial be known
 * before the device is plugged in makes deployment needlessly brittle. Quarantine plus a
 * one-click Approve in the app gives the same protection with none of that friction.
 */
export async function touchDevice(
  store: DocStore,
  config: IngestConfig,
  serialNumber: string,
  info: { ip?: string; firmware?: string; options?: string } = {}
): Promise<DeviceState> {
  const id = safeId(serialNumber);
  const existing = await store.get(COLLECTIONS.devices, id);
  const timestamp = nowIso();

  if (!existing) {
    const status = config.autoApproveDevices ? 'approved' : 'pending';
    await store.set(COLLECTIONS.devices, id, {
      sn: String(serialNumber),
      name: `Device ${serialNumber}`,
      status,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      punchCount: 0,
      ip: info.ip || '',
      firmware: info.firmware || '',
      options: info.options || '',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return { id, status, punchCount: 0, isNew: true };
  }

  // Heartbeat only — a merge write, so an admin's rename or status change is not clobbered.
  const patch: DocData = { lastSeenAt: timestamp, updatedAt: timestamp };
  if (info.ip) patch.ip = info.ip;
  if (info.firmware) patch.firmware = info.firmware;
  if (info.options) patch.options = info.options;
  await store.set(COLLECTIONS.devices, id, patch);

  return {
    id,
    status: String(existing.status || 'pending'),
    punchCount: Number(existing.punchCount || 0),
    isNew: false,
  };
}

/** Bumps the device's punch counters after a successful batch. */
export async function markDevicePunches(
  store: DocStore,
  serialNumber: string,
  device: DeviceState,
  count: number
): Promise<void> {
  if (count <= 0) return;
  const timestamp = nowIso();
  await store.set(COLLECTIONS.devices, safeId(serialNumber), {
    lastPunchAt: timestamp,
    punchCount: device.punchCount + count,
    updatedAt: timestamp,
  });
}

/* -------------------------------------------------------------------- raw logs */

/**
 * Stores a request exactly as it arrived, before anything tries to interpret it.
 *
 * This is the debugging surface for the whole integration. When the device sends something
 * the parser does not expect, the alternative to this collection is a silent gap in
 * attendance and no evidence of what happened.
 */
export async function writeRawLog(
  store: DocStore,
  config: IngestConfig,
  entry: {
    sn?: string;
    method?: string;
    path?: string;
    query?: string;
    headers?: Record<string, string>;
    body?: string;
    bodyBytes?: number;
    outcome?: string;
    error?: string;
    remoteAddress?: string;
  }
): Promise<void> {
  if (config.rawLogMode === 'off') return;

  const body = entry.body || '';
  const truncated = body.length > config.rawLogMaxBytes;
  const id = `${new Date().toISOString().replace(/[-:.]/g, '')}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  await store.set(COLLECTIONS.rawLogs, id, {
    sn: entry.sn || '',
    method: entry.method || '',
    path: entry.path || '',
    query: entry.query || '',
    headers: entry.headers || {},
    body: truncated ? body.slice(0, config.rawLogMaxBytes) : body,
    bodyTruncated: truncated,
    bodyBytes: entry.bodyBytes ?? 0,
    outcome: entry.outcome || 'received',
    error: entry.error || '',
    remoteAddress: entry.remoteAddress || '',
    receivedAt: nowIso(),
    // A Firestore TTL policy on this field deletes old logs for free — see the docs.
    expiresAt: new Date(
      Date.now() + config.rawLogRetentionDays * 24 * 60 * 60 * 1000
    ).toISOString(),
  });
}

/* ------------------------------------------------------------------- employees */

/**
 * Creates an `attendanceEmployees` doc for any PIN we have not seen.
 *
 * Doc ID is the PIN, which is exactly what the ADMS payload carries, so no translation
 * table is needed. New people land flagged "Needs setup" and contribute 0 to payroll until
 * an admin sets their pay basis — the behaviour the attendance module already has.
 */
export async function ensureEmployees(
  store: DocStore,
  pins: string[]
): Promise<{ created: number; names: Map<string, string> }> {
  const ids = [...new Set(pins.map(safeId))].filter(Boolean);
  if (ids.length === 0) return { created: 0, names: new Map() };

  const existing = await store.getMany(COLLECTIONS.employees, ids);
  const names = new Map<string, string>();
  const toCreate: { id: string; data: DocData }[] = [];
  const timestamp = nowIso();

  for (const id of ids) {
    const found = existing.get(id);
    if (found) {
      names.set(id, String(found.name || id));
      continue;
    }
    names.set(id, id);
    toCreate.push({
      id,
      data: {
        empCode: id,
        name: id,
        salaryMode: null,
        salaryAmount: 0,
        standardHoursPerDay: 8,
        active: true,
        source: 'device',
        firstSeenAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
  }

  if (toCreate.length > 0) await store.setMany(COLLECTIONS.employees, toCreate);
  return { created: toCreate.length, names };
}

/**
 * Applies names from a USERINFO upload.
 *
 * ATTLOG carries only the PIN, so without this everyone shows up as a number until an admin
 * types their name in. Existing names are never overwritten — an admin's spelling beats
 * whatever was typed on the terminal keypad.
 */
export async function applyUserInfoNames(
  store: DocStore,
  entries: { pin: string; name: string }[]
): Promise<number> {
  const ids = entries.map((entry) => safeId(entry.pin)).filter(Boolean);
  if (ids.length === 0) return 0;

  const existing = await store.getMany(COLLECTIONS.employees, ids);
  const updates: { id: string; data: DocData }[] = [];
  const timestamp = nowIso();

  for (const entry of entries) {
    const id = safeId(entry.pin);
    if (!id || !entry.name) continue;

    const found = existing.get(id);
    // Only fill a blank or placeholder name; never overwrite a real one.
    if (found && found.name && found.name !== id) continue;

    updates.push({
      id,
      data: found
        ? { name: entry.name, updatedAt: timestamp }
        : {
            empCode: id,
            name: entry.name,
            salaryMode: null,
            salaryAmount: 0,
            standardHoursPerDay: 8,
            active: true,
            source: 'device',
            firstSeenAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
    });
  }

  if (updates.length > 0) await store.setMany(COLLECTIONS.employees, updates);
  return updates.length;
}

/* --------------------------------------------------------------------- punches */

/**
 * Collapses punches into one record per employee per day — the shape the app's Records and
 * Payroll tabs read.
 *
 * check-in = earliest punch of the day, check-out = latest. Naive in/out pairing breaks on
 * the ordinary lunch-break pattern (in, out, in, out) by dropping the afternoon; first/last
 * is right for that and for a simple two-punch day alike.
 */
export async function foldIntoDayRecords(
  store: DocStore,
  rows: AttlogRow[],
  names: Map<string, string>
): Promise<number> {
  const byDay = new Map<string, { empCode: string; date: string; times: Set<string> }>();

  for (const row of rows) {
    const empCode = safeId(row.userPin);
    const id = `${empCode}_${row.normalised.date}`;
    const entry = byDay.get(id) || { empCode, date: row.normalised.date, times: new Set<string>() };
    entry.times.add(row.normalised.time);
    byDay.set(id, entry);
  }

  const existing = await store.getMany(COLLECTIONS.records, [...byDay.keys()]);
  const updates: { id: string; data: DocData }[] = [];
  const timestamp = nowIso();

  for (const [id, entry] of byDay) {
    const prior = existing.get(id);

    // Merge with punches already on record: this batch may be only part of the day, and
    // the device re-sends overlapping windows.
    const priorPunches = Array.isArray(prior?.punches) ? (prior!.punches as string[]) : [];
    const merged = [...new Set([...priorPunches, ...entry.times])].sort();

    const checkIn = merged[0];
    const checkOut = merged.length > 1 ? merged[merged.length - 1] : '';
    const hoursWorked = hoursBetween(checkIn, checkOut);
    const employeeName =
      names.get(entry.empCode) || String(prior?.employeeName || '') || entry.empCode;

    // An admin correction must never be silently reverted. Only the raw punch trail is
    // refreshed on a hand-edited record.
    if (prior?.manuallyEdited) {
      if (JSON.stringify(priorPunches) !== JSON.stringify(merged)) {
        updates.push({ id, data: { punches: merged, updatedAt: timestamp } });
      }
      continue;
    }

    if (
      prior &&
      (prior.checkIn || '') === (checkIn || '') &&
      (prior.checkOut || '') === checkOut &&
      (prior.hoursWorked || 0) === hoursWorked &&
      prior.employeeName === employeeName
    ) {
      continue; // Nothing about this day changed.
    }

    updates.push({
      id,
      data: {
        empCode: entry.empCode,
        employeeName,
        date: entry.date,
        checkIn: checkIn || '',
        checkOut,
        hoursWorked,
        status: checkOut ? 'present' : 'incomplete',
        punches: merged,
        source: 'device',
        manuallyEdited: false,
        createdAt: prior?.createdAt || timestamp,
        updatedAt: timestamp,
      },
    });
  }

  if (updates.length > 0) await store.setMany(COLLECTIONS.records, updates);
  return updates.length;
}

/**
 * Stores parsed ATTLOG rows and folds them into day records.
 *
 * Deduplication is the deterministic document ID `${sn}_${pin}_${YYYYMMDDHHmmss}`: the
 * device replays its whole batch after any failed handshake, and an already-present ID is
 * simply not written again. No unique index, no transaction, no read-modify-write race.
 */
export async function recordPunches(
  store: DocStore,
  config: IngestConfig,
  serialNumber: string,
  rows: AttlogRow[],
  { fold = true }: { fold?: boolean } = {}
): Promise<{ stored: number; duplicates: number; employeesCreated: number; daysWritten: number }> {
  if (rows.length === 0) {
    return { stored: 0, duplicates: 0, employeesCreated: 0, daysWritten: 0 };
  }

  const sn = safeId(serialNumber);
  const timestamp = nowIso();

  const candidates = rows.map((row) => ({
    id: `${sn}_${safeId(row.userPin)}_${row.normalised.compact}`,
    row,
  }));

  const existingPunches = await store.getMany(
    COLLECTIONS.punches,
    candidates.map((candidate) => candidate.id)
  );
  const fresh = candidates.filter((candidate) => !existingPunches.has(candidate.id));

  /**
   * A device awaiting approval still has its punches stored — they are evidence, and
   * discarding them would lose everything punched between plugging the device in and
   * approving it in the app. What it does not get is an employee record or a
   * payroll-visible day record; approving the device backfills those.
   */
  const { created: employeesCreated, names } = fold
    ? await ensureEmployees(store, rows.map((row) => row.userPin))
    : { created: 0, names: new Map<string, string>() };

  if (fresh.length > 0) {
    await store.setMany(
      COLLECTIONS.punches,
      fresh.map(({ id, row }) => ({
        id,
        data: {
          deviceSn: String(serialNumber),
          userPin: row.userPin,
          employeeName: names.get(safeId(row.userPin)) || row.userPin,
          // The exact bytes the device sent, kept verbatim so the evidence survives even if
          // the assumed timezone offset later turns out to be wrong.
          punchTimeRaw: row.timestampRaw,
          punchTimeLocal: row.normalised.local,
          punchDate: row.normalised.date,
          punchTimeUtc: toUtcIso(row.normalised, config.timezoneOffsetMinutes),
          punchState: row.punchState,
          punchStateLabel: punchStateLabel(row.punchState),
          verifyMode: row.verifyMode,
          workCode: row.workCode,
          source: 'adms',
          // True while the device was unapproved. Cleared when the punch is backfilled.
          parked: !fold,
          receivedAt: timestamp,
        },
      }))
    );
  }

  const daysWritten = fold ? await foldIntoDayRecords(store, rows, names) : 0;

  return {
    stored: fresh.length,
    duplicates: candidates.length - fresh.length,
    employeesCreated,
    daysWritten,
  };
}

/* ------------------------------------------------------------- request handler */

/** The one response the device accepts after data. Anything else starts a retry loop. */
const OK: DeviceResponse = { status: 200, body: 'OK', log: '' };
const ok = (log: string): DeviceResponse => ({ ...OK, log });

/**
 * Handles one device request end to end.
 *
 * Framework-agnostic so the Vercel function, the Vite dev server and the simulator all run
 * exactly the same code path.
 */
export async function handleDeviceRequest(
  request: DeviceRequest,
  store: DocStore,
  config: IngestConfig
): Promise<DeviceResponse> {
  const { method, path, query, body } = request;
  const serialNumber = query.SN || query.sn || '';
  const table = (query.table || '').toUpperCase();

  /**
   * Log the raw request BEFORE parsing anything.
   *
   * Guarded so a logging failure can never stop a punch being stored, and never stops the
   * device getting its OK. Command polls are excluded by default: they arrive every ~30s
   * and carry nothing.
   */
  // Everything except the command poll, which arrives every ~30s and carries nothing.
  // Registration and config exchanges are exactly what you need when a device will not
  // connect, so they must not be filtered out.
  const shouldLog = config.rawLogMode === 'all' || !path.endsWith('/getrequest');
  if (shouldLog) {
    try {
      await writeRawLog(store, config, {
        sn: serialNumber,
        method,
        path,
        query: new URLSearchParams(query).toString(),
        headers: request.headers,
        body,
        bodyBytes: request.bodyBytes,
        remoteAddress: request.remoteAddress,
      });
    } catch {
      // Already have the punch in hand; a missing log entry must not cost us the punch.
    }
  }

  /**
   * Optional serial-number allowlist. Answered OK on purpose: a rejected device retries in
   * a loop, and a stranger being quietly ignored beats one hammering the endpoint.
   */
  if (
    config.deviceSerials.length > 0 &&
    serialNumber &&
    !config.deviceSerials.includes(serialNumber)
  ) {
    return ok(`Ignored unlisted serial "${serialNumber}"`);
  }

  if (!serialNumber) {
    // Nothing can be attributed without a serial, but the raw log has the evidence and a
    // device stuck retrying is worse than a logged anomaly.
    return ok(`${method} ${path} with no SN`);
  }

  let device: DeviceState;
  try {
    device = await touchDevice(store, config, serialNumber, {
      ip: request.remoteAddress,
      firmware: request.headers['user-agent'] || '',
      options: query.options || '',
    });
  } catch (error) {
    return ok(`Could not record device ${serialNumber}: ${(error as Error).message}`);
  }

  const approved = device.status === 'approved';
  const blocked = device.status === 'blocked';

  try {
    /* ------------------------------------------------ PushSDK 2.x registration */
    if (path.endsWith('/registry')) {
      return {
        status: 200,
        body: buildRegistryResponse(serialNumber),
        log: `PushSDK registry from ${serialNumber} (${device.status})`,
      };
    }

    if (path.endsWith('/push')) {
      return {
        status: 200,
        body: buildPushConfigResponse(serialNumber, config),
        log: `PushSDK config request from ${serialNumber} (${device.status})`,
      };
    }

    /* -------------------------------------------------- registration handshake */
    if (path.endsWith('/cdata') && method === 'GET') {
      return {
        status: 200,
        body: buildHandshakeResponse(serialNumber, config),
        log:
          `Handshake from ${serialNumber} (${device.status})` +
          (device.isNew ? ' — NEW DEVICE, approve it on the Attendance page' : ''),
      };
    }

    /* ------------------------------------------------------------ data upload */
    if (path.endsWith('/cdata')) {
      if (blocked) return ok(`Ignored ${table || 'data'} from blocked device ${serialNumber}`);

      if (table === 'ATTLOG') {
        const { rows, skipped } = parseAttlog(body);
        const result = await recordPunches(store, config, serialNumber, rows, { fold: approved });
        if (approved) await markDevicePunches(store, serialNumber, device, result.stored);

        return ok(
          `${serialNumber}: ${rows.length} punch(es) in — ${result.stored} new, ` +
            `${result.duplicates} already seen, ${result.daysWritten} day record(s) updated` +
            (skipped.length ? `, ${skipped.length} malformed row(s) skipped` : '') +
            (approved ? '' : ' [device not approved, punches parked]')
        );
      }

      if (table === 'USERINFO') {
        const entries = parseUserInfo(body);
        const updated = approved ? await applyUserInfoNames(store, entries) : 0;
        return ok(`${serialNumber}: USERINFO for ${entries.length} user(s), ${updated} name(s) applied`);
      }

      // OPERLOG and the rest are acknowledged and left in the raw log. We only want the
      // punch event; door events and fingerprint templates are not our business.
      return ok(`${serialNumber}: ${table || 'untyped'} upload acknowledged`);
    }

    /* ---------------------------------------------------------- command queue */
    // No commands are ever queued — this integration reads, it does not drive the device.
    // It still requires a well-formed OK or it retries in a loop.
    return ok(`${serialNumber}: ${path}`);
  } catch (error) {
    const message = (error as Error).message || String(error);

    try {
      await writeRawLog(store, config, {
        sn: serialNumber,
        method,
        path,
        query: new URLSearchParams(query).toString(),
        headers: request.headers,
        body,
        bodyBytes: request.bodyBytes,
        outcome: 'error',
        error: message,
        remoteAddress: request.remoteAddress,
      });
    } catch {
      // Already failing; nothing useful left to do.
    }

    /**
     * Answer OK even though we failed.
     *
     * Counter-intuitive but correct: the body is already in deviceRawLogs so nothing is
     * lost, whereas a non-OK reply puts the device into a retry loop that hammers this
     * endpoint and stalls every later punch behind the failed batch.
     */
    return ok(`ERROR handling ${method} ${path} for ${serialNumber}: ${message}`);
  }
}

/* ---------------------------------------------------------------- memory store */

/**
 * In-memory DocStore with the same semantics as the Firestore one.
 * Lets the simulator exercise every path with no Firebase project and no mocking framework.
 */
export function createMemoryStore(): DocStore & {
  dump(collection: string): DocData[];
} {
  const collections = new Map<string, Map<string, DocData>>();

  const collectionOf = (name: string) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  };

  const clone = <T,>(value: T): T =>
    value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);

  return {
    async get(collection, id) {
      return clone(collectionOf(collection).get(id)) ?? null;
    },
    async getMany(collection, ids) {
      const store = collectionOf(collection);
      const found = new Map<string, DocData>();
      for (const id of new Set(ids)) {
        if (store.has(id)) found.set(id, clone(store.get(id)!));
      }
      return found;
    },
    async setMany(collection, entries) {
      const store = collectionOf(collection);
      for (const entry of entries) {
        // Mirror Firestore's merge: undefined values leave the field alone.
        const merged: DocData = { ...(store.get(entry.id) || {}) };
        for (const [key, value] of Object.entries(entry.data)) {
          if (value !== undefined) merged[key] = value;
        }
        store.set(entry.id, clone(merged));
      }
      return entries.length;
    },
    async set(collection, id, data) {
      await this.setMany(collection, [{ id, data }]);
    },
    dump(collection) {
      return [...collectionOf(collection).entries()].map(([id, data]) => ({ id, ...data }));
    },
  };
}
