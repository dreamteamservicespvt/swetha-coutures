import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Fingerprint } from 'lucide-react';
import QuickRangeToggle, { type QuickRange } from '@/components/QuickRangeToggle';
import SyncStatusBar from '@/components/attendance/SyncStatusBar';
import BiotimeConnectDialog from '@/components/attendance/BiotimeConnectDialog';
import AttendanceRecordsTab from '@/components/attendance/AttendanceRecordsTab';
import EmployeesTab from '@/components/attendance/EmployeesTab';
import PayrollTab from '@/components/attendance/PayrollTab';
import {
  fetchEmployees as fetchAttendanceEmployees,
  fetchRecords,
  fetchSyncState,
} from '@/utils/attendance/attendanceStore';
import { checkBiotimeStatus, syncFromBiotime, type BiotimeStatus } from '@/utils/attendance/biotimeSync';
import { toDateKey } from '@/utils/attendance/salaryCalc';
import type {
  AttendanceEmployee,
  AttendanceRecord,
  BiotimeSyncState,
} from '@/utils/attendance/types';

/** How often the page re-pulls punches from BioTime while it is open and visible. */
const LIVE_REFRESH_MS = 60_000;

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
 * Punches arrive from BioTime Cloud through the /api/biotime proxy; everything here
 * reads and writes the attendanceEmployees / attendanceRecords / salaryPayments
 * collections. No existing collection is touched.
 */
const Attendance: React.FC = () => {
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [syncState, setSyncState] = useState<BiotimeSyncState>({});
  const [status, setStatus] = useState<BiotimeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [range, setRange] = useState<QuickRange>('month');
  const [connectOpen, setConnectOpen] = useState(false);

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

    const rows = await fetchRecords(start, end);
    setRecords(rows);
  }, [bounds.start, bounds.end, payrollRange]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [employeeRows, syncStateRow] = await Promise.all([
        fetchAttendanceEmployees(),
        fetchSyncState(),
      ]);
      setEmployees(employeeRows);
      setSyncState(syncStateRow);
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

  const runSync = useCallback(
    async (silent = false) => {
      setSyncing(true);
      try {
        const outcome = await syncFromBiotime();

        if (outcome.status === 'success') {
          // The background poll re-reads an overlap window every minute, so "punches
          // found" is true almost always. Only announce a silent sync when something
          // actually changed, otherwise the user gets a toast every 60 seconds.
          const changed = outcome.daysWritten > 0 || outcome.employeesCreated > 0;

          if (!silent || changed) {
            toast({
              title: changed ? 'Attendance updated' : 'Sync complete — nothing new',
              description: changed
                ? `${outcome.daysWritten} day record(s) updated` +
                  (outcome.employeesCreated
                    ? `, ${outcome.employeesCreated} new employee(s) added`
                    : '')
                : `BioTime returned ${outcome.punches} punch(es), all already recorded.`,
            });
          }
        } else if (outcome.status === 'error' && !silent) {
          toast({
            title: 'Sync failed',
            description: outcome.message || 'Unknown error',
            variant: 'destructive',
          });
        }

        await loadAll();
      } finally {
        setSyncing(false);
      }
    },
    [loadAll]
  );

  // On first open, check the connection and pull quietly if it is configured.
  useEffect(() => {
    let cancelled = false;
    checkBiotimeStatus().then((result) => {
      if (cancelled) return;
      setStatus(result);
      if (result.configured && !result.error) runSync(true);
    });
    return () => {
      cancelled = true;
    };
    // Deliberately runs once on mount: an auto-sync on every dependency change would
    // hammer BioTime as the user clicks around.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Live refresh: re-pull every 60s while the page is open, so a punch made at the
   * device shows up without anyone clicking anything.
   *
   * Paused while the tab is hidden — a backgrounded tab polling BioTime all day earns
   * nothing but rate-limiting. Syncs once immediately on becoming visible again to
   * cover whatever was missed.
   */
  useEffect(() => {
    if (!status?.configured || status.error) return;

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      runSync(true);
    };

    const interval = window.setInterval(tick, LIVE_REFRESH_MS);
    document.addEventListener('visibilitychange', tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [status?.configured, status?.error, runSync]);

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

      <SyncStatusBar
        status={status}
        syncState={syncState}
        syncing={syncing}
        onSync={() => runSync(false)}
        onConnect={() => setConnectOpen(true)}
      />

      <BiotimeConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onSaved={async () => {
          // Re-check with the new credentials, then pull straight away so the admin
          // sees whether it worked without having to press anything else.
          const result = await checkBiotimeStatus();
          setStatus(result);
          if (result.configured && !result.error) {
            await runSync(false);
          } else if (result.error) {
            toast({
              title: 'BioTime connection failed',
              description: result.error,
              variant: 'destructive',
            });
          }
        }}
      />

      <Tabs defaultValue="records" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
          <TabsTrigger value="records">Records</TabsTrigger>
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
