/** Shared types for the biometric attendance & payroll module. */

export type SalaryMode = 'monthly' | 'daily' | 'hourly';

/**
 * One unique person tracked by the fingerprint device.
 * Firestore doc ID = empCode (the BioTime employee code — stable and device-issued).
 */
export interface AttendanceEmployee {
  id: string;
  empCode: string;
  name: string;
  department?: string;
  /** null until the admin configures pay. Such an employee contributes 0 to payroll. */
  salaryMode: SalaryMode | null;
  salaryAmount: number;
  /** Used by the hourly mode's day estimates and shown as context on the payroll tab. */
  standardHoursPerDay: number;
  active: boolean;
  /** Optional link to an existing `staff` doc. Purely informational. */
  linkedStaffId?: string;
  source: 'biotime' | 'manual';
  firstSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * One person, one calendar day.
 * Firestore doc ID = `${empCode}_${date}` — deterministic, which is what makes
 * re-syncing an overlapping window idempotent instead of duplicating rows.
 */
export interface AttendanceRecord {
  id: string;
  empCode: string;
  employeeName: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:mm' */
  checkIn?: string;
  /** 'HH:mm' */
  checkOut?: string;
  hoursWorked: number;
  /** 'incomplete' = punched in but never out, so hours cannot be trusted. */
  status: 'present' | 'incomplete';
  /** Every raw punch seen that day, kept for audit when times look wrong. */
  punches?: string[];
  source: 'biotime' | 'manual';
  /** When true, sync will not overwrite checkIn/checkOut. */
  manuallyEdited?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * A salary payment for one employee for one month.
 * Firestore doc ID = `${empCode}_${periodKey}`.
 */
export interface SalaryPayment {
  id: string;
  empCode: string;
  employeeName: string;
  /** 'YYYY-MM' */
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  /** Snapshot at time of payment — a later rate change must not rewrite history. */
  amount: number;
  daysWorked: number;
  hoursWorked: number;
  salaryMode: SalaryMode | null;
  /** Undo is a soft revert, so an accidental click and its correction both stay visible. */
  status: 'paid' | 'reverted';
  paidAt: string;
  paidBy: string;
  revertedAt?: string;
  revertedBy?: string;
}

export interface BiotimeSyncState {
  lastSyncedAt?: string;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'error' | 'not_configured';
  lastError?: string;
  punchesImported?: number;
  employeesCreated?: number;
}

/** Result of one sync run, surfaced to the user as a toast. */
export interface SyncOutcome {
  status: 'success' | 'error' | 'not_configured';
  punches: number;
  daysWritten: number;
  employeesCreated: number;
  message?: string;
}
