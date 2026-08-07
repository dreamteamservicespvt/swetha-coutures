/**
 * Bridges the Employees page (`staff` collection) and the biometric attendance module
 * (`attendanceEmployees` / `attendanceRecords`).
 *
 * The two collections are deliberately separate — attendance is device-driven and keyed by
 * the fingerprint employee code, while `staff` holds the HR record. This module is the one
 * place that joins them, so an employee's pay basis lives in a single spot and their payable
 * salary can be derived from real check-in / check-out times.
 */
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  fetchEmployees,
  fetchRecords,
  saveEmployee,
} from './attendanceStore';
import { calculateSalary, monthBounds, toMonthKey } from './salaryCalc';
import type { AttendanceEmployee, AttendanceRecord, SalaryMode } from './types';

export interface StaffPay {
  id: string;
  name?: string;
  salaryMode?: SalaryMode;
  salaryAmount?: number;
  bonus?: number;
  attendanceEmpCode?: string;
}

export interface AttendanceSummary {
  /** The matched attendance employee, if any. */
  empCode?: string;
  matchedBy: 'code' | 'name' | 'none';
  daysPresent: number;
  hoursWorked: number;
  workingDays: number;
  /** Salary earned for the period from attendance, before bonus. */
  earned: number;
  bonus: number;
  /** earned + bonus — what the business owes this employee for the period. */
  payable: number;
  formula: string;
  lastCheckIn?: string;
  lastCheckOut?: string;
  lastDate?: string;
}

const normalise = (value?: string) => (value || '').trim().toLowerCase();

/**
 * Finds the attendance employee for a staff record.
 *
 * Prefers the explicit link (`staff.attendanceEmpCode`, or the attendance side's
 * `linkedStaffId`) and falls back to an exact name match, which covers the common case
 * where the same person was typed into both places without anyone linking them.
 */
export function matchAttendanceEmployee(
  staff: StaffPay,
  employees: AttendanceEmployee[]
): { employee?: AttendanceEmployee; matchedBy: 'code' | 'name' | 'none' } {
  if (staff.attendanceEmpCode) {
    const byCode = employees.find((e) => e.empCode === staff.attendanceEmpCode);
    if (byCode) return { employee: byCode, matchedBy: 'code' };
  }

  const byLink = employees.find((e) => e.linkedStaffId && e.linkedStaffId === staff.id);
  if (byLink) return { employee: byLink, matchedBy: 'code' };

  const byName = employees.find((e) => normalise(e.name) === normalise(staff.name));
  if (byName) return { employee: byName, matchedBy: 'name' };

  return { matchedBy: 'none' };
}

/**
 * Payable salary for one staff member over a month, derived from their attendance.
 *
 * Pay basis and rate come from the *staff* record — that is the form the admin fills in —
 * while days and hours come from the fingerprint records. If the staff record has no rate
 * set, the attendance employee's own rate is used as a fallback.
 */
export function summariseAttendance(
  staff: StaffPay,
  employees: AttendanceEmployee[],
  records: AttendanceRecord[],
  periodKey: string = toMonthKey(new Date())
): AttendanceSummary {
  const { employee, matchedBy } = matchAttendanceEmployee(staff, employees);
  const { start, end } = monthBounds(periodKey);
  const bonus = staff.bonus || 0;

  if (!employee) {
    return {
      matchedBy: 'none',
      daysPresent: 0,
      hoursWorked: 0,
      workingDays: 0,
      earned: 0,
      bonus,
      payable: bonus,
      formula: 'No attendance record linked',
    };
  }

  // Staff rate wins; attendance rate is the fallback for employees set up on that side first.
  const effective: AttendanceEmployee = {
    ...employee,
    salaryMode: (staff.salaryMode || employee.salaryMode) ?? null,
    salaryAmount: staff.salaryAmount || employee.salaryAmount || 0,
  };

  const breakdown = calculateSalary(effective, records, start, end);
  const own = records
    .filter((record) => record.empCode === employee.empCode && record.date >= start && record.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    empCode: employee.empCode,
    matchedBy,
    daysPresent: breakdown.daysWorked,
    hoursWorked: breakdown.hoursWorked,
    workingDays: breakdown.workingDays,
    earned: breakdown.amount,
    bonus,
    payable: breakdown.amount + bonus,
    formula: breakdown.formula,
    lastCheckIn: own[0]?.checkIn,
    lastCheckOut: own[0]?.checkOut,
    lastDate: own[0]?.date,
  };
}

/** Loads everything needed to summarise a whole staff list for one month, in two reads. */
export async function loadAttendanceContext(periodKey: string = toMonthKey(new Date())): Promise<{
  employees: AttendanceEmployee[];
  records: AttendanceRecord[];
}> {
  const { start, end } = monthBounds(periodKey);
  const [employees, records] = await Promise.all([fetchEmployees(), fetchRecords(start, end)]);
  return { employees, records };
}

/**
 * Pushes a staff member's pay settings onto their linked attendance employee, so the
 * Payroll tab and the Employees page always quote the same number. Silently does nothing
 * when there is nothing to link to — an unlinked employee is a normal state, not an error.
 */
export async function syncPayToAttendance(
  staff: StaffPay,
  employees: AttendanceEmployee[]
): Promise<string | null> {
  const { employee } = matchAttendanceEmployee(staff, employees);
  if (!employee) return null;

  await saveEmployee(employee.empCode, {
    salaryMode: (staff.salaryMode || null) as SalaryMode | null,
    salaryAmount: staff.salaryAmount || 0,
    linkedStaffId: staff.id,
  });

  // Record the link on the staff side too, so a later rename cannot break the match.
  if (staff.attendanceEmpCode !== employee.empCode) {
    await updateDoc(doc(db, 'staff', staff.id), { attendanceEmpCode: employee.empCode });
  }

  return employee.empCode;
}
