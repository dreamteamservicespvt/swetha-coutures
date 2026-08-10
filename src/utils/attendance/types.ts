/** Shared types for the biometric attendance & payroll module. */

export type SalaryMode = 'monthly' | 'daily' | 'hourly';

/**
 * One unique person tracked by the fingerprint device.
 * Firestore doc ID = empCode — the numeric user PIN assigned on the fingerprint device.
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
  /** 'device' = created by a punch arriving over ADMS from the office terminal. */
  source: 'manual' | 'device';
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
  source: 'manual' | 'device';
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

/**
 * A fingerprint terminal that has contacted the ingest server.
 * Firestore doc ID = the device's serial number.
 */
export interface AttendanceDevice {
  id: string;
  sn: string;
  name: string;
  /**
   * 'pending' = seen but not yet trusted. Its punches are stored but kept out of
   * payroll until an admin approves it, so the public ingest endpoint cannot be used
   * by a stranger to invent attendance.
   */
  status: 'pending' | 'approved' | 'blocked';
  /** Any contact at all, including the empty command polls the device sends every ~30s. */
  lastSeenAt?: string;
  /** The last time an actual punch arrived. */
  lastPunchAt?: string;
  punchCount?: number;
  ip?: string;
  firmware?: string;
  firstSeenAt?: string;
  updatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

/**
 * One fingerprint press, exactly as the device reported it.
 * Firestore doc ID = `${sn}_${userPin}_${YYYYMMDDHHmmss}` — deterministic, which is what
 * makes the device's retries idempotent instead of duplicating punches.
 */
export interface DevicePunch {
  id: string;
  deviceSn: string;
  userPin: string;
  employeeName?: string;
  /** The device's original string, stored verbatim and never reformatted. */
  punchTimeRaw: string;
  /** 'YYYY-MM-DD HH:mm:ss' */
  punchTimeLocal: string;
  /** 'YYYY-MM-DD' */
  punchDate: string;
  /** ISO 8601 UTC, derived by applying the configured device offset. */
  punchTimeUtc?: string;
  punchState?: string;
  punchStateLabel?: string;
  verifyMode?: string;
  workCode?: string;
  source?: string;
  /** True while the sending device was still awaiting approval. */
  parked?: boolean;
  receivedAt?: string;
}
