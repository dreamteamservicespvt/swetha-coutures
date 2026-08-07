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
import { Pencil, Plus, Trash2, Search, LogIn, LogOut, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { deleteRecord } from '@/utils/attendance/attendanceStore';
import type { AttendanceEmployee, AttendanceRecord } from '@/utils/attendance/types';
import RecordEditDialog from './RecordEditDialog';

interface AttendanceRecordsTabProps {
  records: AttendanceRecord[];
  employees: AttendanceEmployee[];
  loading: boolean;
  onChanged: () => void;
}

/** '2026-08-06' -> '06 Aug 2026' */
function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year) return dateKey;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const AttendanceRecordsTab: React.FC<AttendanceRecordsTabProps> = ({
  records,
  employees,
  loading,
  onChanged,
}) => {
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (employeeFilter !== 'all' && record.empCode !== employeeFilter) return false;
      if (!term) return true;
      return (
        (record.employeeName || '').toLowerCase().includes(term) ||
        record.empCode.toLowerCase().includes(term) ||
        record.date.includes(term)
      );
    });
  }, [records, search, employeeFilter]);

  const totals = useMemo(
    () => ({
      days: filtered.filter((record) => !!record.checkIn).length,
      hours: Math.round(filtered.reduce((sum, r) => sum + (r.hoursWorked || 0), 0) * 100) / 100,
      incomplete: filtered.filter((record) => record.status === 'incomplete').length,
    }),
    [filtered]
  );

  const handleDelete = async (record: AttendanceRecord) => {
    if (!window.confirm(`Delete attendance for ${record.employeeName} on ${formatDate(record.date)}?`)) {
      return;
    }
    try {
      await deleteRecord(record.id);
      toast({ title: 'Attendance deleted' });
      onChanged();
    } catch (error) {
      toast({
        title: 'Could not delete',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <LogIn className="h-5 w-5 shrink-0 text-green-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Days present</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.days}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Total hours</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.hours}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <LogOut className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">No check-out</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.incomplete}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, code or date"
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
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add
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
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-gray-500">
                      Loading attendance…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-gray-500">
                      No attendance records for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {record.employeeName}
                        </div>
                        <div className="text-xs text-gray-500">{record.empCode}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(record.date)}</TableCell>
                      <TableCell className="font-mono">{record.checkIn || '—'}</TableCell>
                      <TableCell className="font-mono">{record.checkOut || '—'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {record.hoursWorked ? record.hoursWorked.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {record.status === 'incomplete' ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              No check-out
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300">
                              Present
                            </Badge>
                          )}
                          {record.manuallyEdited && (
                            <Badge variant="outline" className="text-xs">Manual</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(record);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(record)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RecordEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editing}
        employees={employees}
        onSaved={onChanged}
      />
    </div>
  );
};

export default AttendanceRecordsTab;
