/**
 * Backup reminder state.
 *
 * Kept in Firestore (`syncState/backup`) rather than localStorage on purpose: the reminder
 * has to follow the business, not the browser. Clearing site data, switching to a phone or
 * reinstalling should never make the app think a backup was taken when it wasn't.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const BACKUP_STATE_DOC = 'backup';

export interface BackupLogEntry {
  /** 'YYYY-MM' for a monthly backup, or 'full' for a complete export. */
  periodKey: string;
  label: string;
  exportedAt: string;
  exportedBy: string;
  rows: number;
  filename: string;
}

export interface BackupState {
  /** Set once the first full export has been taken. */
  firstFullExportAt?: string;
  /** Month keys that have been exported, e.g. ['2026-06', '2026-07']. */
  exportedMonths?: string[];
  lastExportAt?: string;
  lastExportLabel?: string;
  /** Most recent exports first; capped so the doc cannot grow without bound. */
  history?: BackupLogEntry[];
  /** Reminder snoozed until this ISO date. */
  snoozedUntil?: string;
}

const MAX_HISTORY = 60;

export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

/** First and last instant of a 'YYYY-MM' month. */
export const monthRange = (key: string): { start: Date; end: Date } => {
  const [year, month] = key.split('-').map(Number);
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end: new Date(year, month, 0, 23, 59, 59, 999),
  };
};

export async function fetchBackupState(): Promise<BackupState> {
  try {
    const snap = await getDoc(doc(db, 'syncState', BACKUP_STATE_DOC));
    return snap.exists() ? (snap.data() as BackupState) : {};
  } catch (error) {
    console.error('Could not read backup state:', error);
    return {};
  }
}

export async function recordBackup(input: {
  periodKey: string;
  label: string;
  rows: number;
  filename: string;
  exportedBy: string;
  isFull: boolean;
}): Promise<void> {
  const state = await fetchBackupState();
  const entry: BackupLogEntry = {
    periodKey: input.periodKey,
    label: input.label,
    exportedAt: new Date().toISOString(),
    exportedBy: input.exportedBy,
    rows: input.rows,
    filename: input.filename,
  };

  const months = new Set(state.exportedMonths || []);
  if (input.periodKey !== 'full' && input.periodKey !== 'custom') {
    months.add(input.periodKey);
  }
  // A full export covers everything up to now, so it satisfies every past month too.
  if (input.isFull) {
    outstandingMonths({ ...state, firstFullExportAt: state.firstFullExportAt }).forEach((key) =>
      months.add(key)
    );
    months.add(monthKey(new Date()));
  }

  await setDoc(
    doc(db, 'syncState', BACKUP_STATE_DOC),
    {
      ...(input.isFull && !state.firstFullExportAt
        ? { firstFullExportAt: entry.exportedAt }
        : {}),
      exportedMonths: Array.from(months).sort(),
      lastExportAt: entry.exportedAt,
      lastExportLabel: input.label,
      history: [entry, ...(state.history || [])].slice(0, MAX_HISTORY),
      snoozedUntil: '',
    },
    { merge: true }
  );
}

export async function snoozeReminder(days = 3): Promise<void> {
  const until = new Date();
  until.setDate(until.getDate() + days);
  await setDoc(
    doc(db, 'syncState', BACKUP_STATE_DOC),
    { snoozedUntil: until.toISOString() },
    { merge: true }
  );
}

/**
 * Completed months that still have no backup.
 *
 * Only *finished* months count — nagging on the 3rd of the month for a month that is still
 * running would train the user to dismiss the reminder, which defeats the point. Looks back
 * 12 months so a long-neglected account is not asked for years of history at once.
 */
export function outstandingMonths(state: BackupState): string[] {
  const done = new Set(state.exportedMonths || []);
  const out: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() - 1); // start at last completed month

  for (let i = 0; i < 12; i++) {
    const key = monthKey(cursor);
    if (!done.has(key)) out.push(key);
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return out;
}

export type ReminderKind = 'first-full' | 'monthly' | 'none';

export interface ReminderDecision {
  kind: ReminderKind;
  /** Months still missing a backup, newest first. */
  months: string[];
  state: BackupState;
}

/** Decides what (if anything) to nag the admin about right now. */
export function decideReminder(state: BackupState): ReminderDecision {
  if (state.snoozedUntil && new Date(state.snoozedUntil) > new Date()) {
    return { kind: 'none', months: [], state };
  }

  if (!state.firstFullExportAt) {
    return { kind: 'first-full', months: [], state };
  }

  const months = outstandingMonths(state);
  // Months before the first full export are already covered by it.
  const firstExport = new Date(state.firstFullExportAt);
  const relevant = months.filter((key) => {
    const { end } = monthRange(key);
    return end > firstExport;
  });

  return relevant.length > 0
    ? { kind: 'monthly', months: relevant, state }
    : { kind: 'none', months: [], state };
}
