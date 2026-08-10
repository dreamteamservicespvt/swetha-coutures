import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Fingerprint } from 'lucide-react';
import QuickRangeToggle, { type QuickRange } from '@/components/QuickRangeToggle';
import DeviceHealthBar from '@/components/attendance/DeviceHealthBar';
import AttendanceRecordsTab from '@/components/attendance/AttendanceRecordsTab';
import EmployeesTab from '@/components/attendance/EmployeesTab';
import PayrollTab from '@/components/attendance/PayrollTab';
import PunchesTab from '@/components/attendance/PunchesTab';
import {
  fetchEmployees as fetchAttendanceEmployees,
  fetchRecords,
} from '@/utils/attendance/attendanceStore';
import { fetchDevices, fetchPunches } from '@/utils/attendance/deviceStore';
import { toDateKey } from '@/utils/attendance/salaryCalc';
import type {
  AttendanceDevice,
  AttendanceEmployee,
  AttendanceRecord,
  DevicePunch,
} from '@/utils/attendance/types';

/**
 * How often the page re-reads Firestore.
 *
 * The device pushes to /iclock/cdata, which writes straight to Firestore, so there is
 * nothing for the page to pull. This interval only controls how quickly an already-open
 * page notices a punch that has already landed.
 */
const DEVICE_REFRESH_MS = 30_000;

/** Date bounds for a quick range. `career` returns undefined bounds = fetch everything. */
function rangeBounds(range: QuickRange): { start?: string; end?: string } {
  const now = new Date();
  if (range === 'today') {
    const today = toDateKey(now);
    return { start: today, end: today };
  }
  if (range === 'month') {
    return {
      start: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  return {};
}

/**
 * Biometric attendance & payroll.
 *
 * Punches arrive by push from the office fingerprint terminal to /iclock/cdata, which
 * writes them to Firestore. Everything here only reads devices / devicePunches /
 * attendanceEmployees / attendanceRecords / salaryPayments. No existing collection is
 * touched.
 */
const Attendance: React.FC = () => {
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [punches, setPunches] = useState<DevicePunch[]>([]);
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<QuickRange>('month');

  // The payroll tab needs its own month, which may sit outside the Records filter.
  // Tracked in a ref so asking for a range never re-triggers the effect that loads it.
  const [payrollRange, setPayrollRange] = useState<{ start: string; end: string } | null>(null);
  const payrollRangeRef = useRef<string>('');

  const bounds = useMemo(() => rangeBounds(range), [range]);

  const loadRecords = useCallback(async () => {
    // Widen the query to cover both the Records filter and the payroll month, so one
    // fetch serves both tabs and switching tabs does not blank the table.
    const starts = [bounds.start, payrollRange?.start].filter(Boolean) as string[];
    const ends = [bounds.end, payrollRange?.end].filter(Boolean) as string[];

    // A missing bound anywhere means "all time" — do not narrow the query.
    const start = bounds.start && payrollRange ? starts.sort()[0] : bounds.start;
    const end = bounds.end && payrollRange ? ends.sort()[ends.length - 1] : bounds.end;

    // Records and raw punches share the same window, so one pair of bounds serves both.
    const [rows, punchRows] = await Promise.all([
      fetchRecords(start, end),
      fetchPunches(bounds.start, bounds.end),
    ]);
    setRecords(rows);
    setPunches(punchRows);
  }, [bounds.start, bounds.end, payrollRange]);

  /** `silent` skips the skeleton — the background refresh must not blank the table. */
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [employeeRows, deviceRows] = await Promise.all([
        fetchAttendanceEmployees(),
        fetchDevices().catch(() => [] as AttendanceDevice[]),
      ]);
      setEmployees(employeeRows);
      setDevices(deviceRows);
      await loadRecords();
    } catch (error) {
      toast({
        title: 'Could not load attendance',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [loadRecords]);

  // Staff list is read once, only to offer the optional "link to staff member" choice.
  useEffect(() => {
    getDocs(collection(db, 'staff'))
      .then((snapshot) =>
        setStaffOptions(
          snapshot.docs.map((snap) => ({
            id: snap.id,
            name: (snap.data().name as string) || snap.id,
          }))
        )
      )
      .catch(() => setStaffOptions([]));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /**
   * Keeps an open page current with what the device has already pushed.
   *
   * A plain Firestore re-read — there is nothing to pull from anywhere, the punch is
   * already stored by the time this runs. Paused while the tab is hidden, and re-read
   * immediately on return so a backgrounded tab catches up in one go.
   */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      loadAll(true);
    };

    const interval = window.setInterval(tick, DEVICE_REFRESH_MS);
    document.addEventListener('visibilitychange', tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [loadAll]);

  const handleNeedRange = useCallback((start: string, end: string) => {
    const key = `${start}_${end}`;
    if (payrollRangeRef.current === key) return;
    payrollRangeRef.current = key;
    setPayrollRange({ start, end });
  }, []);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 p-2.5">
            <Fingerprint className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Fingerprint check-in / check-out and salary
            </p>
          </div>
        </div>
        <QuickRangeToggle value={range} onChange={setRange} />
      </div>

      <DeviceHealthBar devices={devices} loading={loading} onChanged={loadAll} />

      <Tabs defaultValue="records" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex md:grid-cols-4">
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="punches">Punches</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="records">
          <AttendanceRecordsTab
            records={records}
            employees={employees}
            loading={loading}
            onChanged={loadAll}
          />
        </TabsContent>

        <TabsContent value="punches">
          <PunchesTab punches={punches} employees={employees} loading={loading} />
        </TabsContent>

        <TabsContent value="employees">
          <EmployeesTab
            employees={employees}
            staffOptions={staffOptions}
            loading={loading}
            onChanged={loadAll}
          />
        </TabsContent>

        <TabsContent value="payroll">
          <PayrollTab
            employees={employees}
            allRecords={records}
            onNeedRange={handleNeedRange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Attendance;
