/**
 * Salary maths. Pure functions only — no Firestore, no React — so the money logic
 * can be reasoned about and tested in isolation from the UI that displays it.
 */
import type { AttendanceEmployee, AttendanceRecord } from './types';

export interface SalaryBreakdown {
  daysWorked: number;
  hoursWorked: number;
  /** Working days in the period, used as the divisor for pro-rated monthly pay. */
  workingDays: number;
  amount: number;
  /** True when the employee has no salary mode/amount set yet. */
  needsSetup: boolean;
  /** Human-readable explanation of how `amount` was reached. */
  formula: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** 'YYYY-MM-DD' -> Date at local midnight. Avoids the UTC shift of `new Date(str)`. */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** Date -> 'YYYY-MM-DD' using local time, matching how punch dates are stored. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Working days between two dates inclusive, excluding Sundays.
 * Sunday-only is the common six-day week for a tailoring shop; excluding Saturday too
 * would inflate the per-day rate for a shop that actually opens on Saturdays.
 */
export function countWorkingDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (end < start) return 0;

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getDay() !== 0) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Minutes between two 'HH:mm' times, as decimal hours. Returns 0 if either is missing. */
export function hoursBetween(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  if ([inH, inM, outH, outM].some((n) => Number.isNaN(n))) return 0;

  let minutes = outH * 60 + outM - (inH * 60 + inM);
  // A checkout before the check-in means the shift crossed midnight.
  if (minutes < 0) minutes += 24 * 60;
  return round2(minutes / 60);
}

/**
 * Computes what an employee earned over a period from their attendance.
 *
 * - daily   → rate x days present
 * - hourly  → rate x hours actually worked
 * - monthly → salary / working days x days present, capped at the full salary so an
 *             extra Sunday shift cannot pay more than the agreed monthly figure
 */
export function calculateSalary(
  employee: AttendanceEmployee,
  records: AttendanceRecord[],
  periodStart: string,
  periodEnd: string
): SalaryBreakdown {
  const inPeriod = records.filter(
    (record) =>
      record.empCode === employee.empCode &&
      record.date >= periodStart &&
      record.date <= periodEnd
  );

  const daysWorked = inPeriod.filter((record) => !!record.checkIn).length;
  const hoursWorked = round2(
    inPeriod.reduce((sum, record) => sum + (record.hoursWorked || 0), 0)
  );
  const workingDays = countWorkingDays(periodStart, periodEnd);

  const base = {
    daysWorked,
    hoursWorked,
    workingDays,
  };

  if (!employee.salaryMode || !employee.salaryAmount || employee.salaryAmount <= 0) {
    return { ...base, amount: 0, needsSetup: true, formula: 'Salary not configured' };
  }

  const rate = employee.salaryAmount;

  switch (employee.salaryMode) {
    case 'daily':
      return {
        ...base,
        amount: round2(rate * daysWorked),
        needsSetup: false,
        formula: `₹${rate}/day × ${daysWorked} day${daysWorked === 1 ? '' : 's'}`,
      };

    case 'hourly':
      return {
        ...base,
        amount: round2(rate * hoursWorked),
        needsSetup: false,
        formula: `₹${rate}/hr × ${hoursWorked} hr${hoursWorked === 1 ? '' : 's'}`,
      };

    case 'monthly': {
      if (workingDays === 0) {
        return { ...base, amount: 0, needsSetup: false, formula: 'No working days in period' };
      }
      const prorated = Math.min(round2((rate / workingDays) * daysWorked), rate);
      return {
        ...base,
        amount: prorated,
        needsSetup: false,
        formula: `₹${rate}/month ÷ ${workingDays} working days × ${daysWorked} present`,
      };
    }

    default:
      return { ...base, amount: 0, needsSetup: true, formula: 'Unknown salary mode' };
  }
}

/** First and last day of a 'YYYY-MM' month, as date keys. */
export function monthBounds(periodKey: string): { start: string; end: string } {
  const [year, month] = periodKey.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // day 0 of next month = last day of this one
  return { start: toDateKey(start), end: toDateKey(end) };
}

/** 'YYYY-MM' for a date. */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 'August 2026' from '2026-08'. */
export function formatMonthLabel(periodKey: string): string {
  const [year, month] = periodKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

/** Rupee formatting consistent with the rest of the app. */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
