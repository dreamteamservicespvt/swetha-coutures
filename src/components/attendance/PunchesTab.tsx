import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Fingerprint, LogIn, LogOut, Search } from 'lucide-react';
import { saveAs } from 'file-saver';
import { toast } from '@/hooks/use-toast';
import type { AttendanceEmployee, DevicePunch } from '@/utils/attendance/types';

interface PunchesTabProps {
  punches: DevicePunch[];
  employees: AttendanceEmployee[];
  loading: boolean;
}

/** '2026-08-08' -> '08 Aug 2026' */
function formatDate(dateKey: string): string {
  const [year, month, day] = (dateKey || '').split('-').map(Number);
  if (!year) return dateKey || '—';
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** '2026-08-08 09:14:22' -> '09:14:22' */
function timeOf(punch: DevicePunch): string {
  const parts = (punch.punchTimeLocal || '').split(' ');
  return parts[1] || punch.punchTimeRaw || '—';
}

/**
 * RFC 4180 escaping.
 *
 * Names routinely contain commas and the occasional quote, and a raw join(',') would
 * silently shift every later column on those rows — the kind of export bug nobody
 * notices until the spreadsheet is already with the accountant.
 */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Raw fingerprint punches, exactly as the device reported them.
 *
 * The Records tab shows the day summary that payroll uses; this is the evidence behind
 * it. When someone disputes a day, this is where the individual presses are.
 */
const PunchesTab: React.FC<PunchesTabProps> = ({ punches, employees, loading }) => {
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return punches.filter((punch) => {
      if (employeeFilter !== 'all' && punch.userPin !== employeeFilter) return false;
      if (!term) return true;
      return (
        (punch.employeeName || '').toLowerCase().includes(term) ||
        (punch.userPin || '').toLowerCase().includes(term) ||
        (punch.punchTimeLocal || '').toLowerCase().includes(term) ||
        (punch.deviceSn || '').toLowerCase().includes(term)
      );
    });
  }, [punches, search, employeeFilter]);

  const totals = useMemo(
    () => ({
      total: filtered.length,
      checkIns: filtered.filter((punch) => punch.punchState === '0').length,
      checkOuts: filtered.filter((punch) => punch.punchState === '1').length,
    }),
    [filtered]
  );

  const handleExport = () => {
    if (filtered.length === 0) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }

    const headers = [
      'Employee',
      'PIN',
      'Date',
      'Time',
      'Type',
      'Device time (raw)',
      'UTC',
      'Verify mode',
      'Device',
      'Received at',
    ];

    const rows = filtered.map((punch) => [
      punch.employeeName || punch.userPin,
      punch.userPin,
      punch.punchDate,
      timeOf(punch),
      punch.punchStateLabel || 'Punch',
      punch.punchTimeRaw,
      punch.punchTimeUtc || '',
      punch.verifyMode || '',
      punch.deviceSn,
      punch.receivedAt || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

    // A BOM so Excel opens the file as UTF-8 rather than mangling names.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const stamp = new Date().toISOString().slice(0, 10);
    saveAs(blob, `punches-${stamp}.csv`);

    toast({ title: `Exported ${filtered.length} punch${filtered.length === 1 ? '' : 'es'}` });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Fingerprint className="h-5 w-5 shrink-0 text-purple-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Punches</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <LogIn className="h-5 w-5 shrink-0 text-green-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Check-ins</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.checkIns}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <LogOut className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Check-outs</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.checkOuts}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, PIN, time or device"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map((employee) => (
              <SelectItem key={employee.empCode} value={employee.empCode}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-gray-500">
                      Loading punches…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <Fingerprint className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        No punches for this period
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Every fingerprint press on the office device appears here within seconds.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((punch) => (
                    <TableRow key={punch.id}>
                      <TableCell>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {punch.employeeName || punch.userPin}
                        </div>
                        <div className="text-xs text-gray-500">PIN {punch.userPin}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(punch.punchDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono">{timeOf(punch)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {punch.punchState === '1' ? (
                            <Badge
                              variant="outline"
                              className="border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                            >
                              {punch.punchStateLabel || 'Check out'}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-green-300 bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                            >
                              {punch.punchStateLabel || 'Check in'}
                            </Badge>
                          )}
                          {punch.parked && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                            >
                              Held
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">
                        {punch.deviceSn}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500">
        These are the raw presses as the device reported them. The Records tab folds them into one
        check-in and check-out per day, which is what Payroll uses. A punch marked “Held” arrived
        while its device was still awaiting approval.
      </p>
    </div>
  );
};

export default PunchesTab;
