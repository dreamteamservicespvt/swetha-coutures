import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { saveRecordManually } from '@/utils/attendance/attendanceStore';
import { hoursBetween } from '@/utils/attendance/salaryCalc';
import { todayKey } from '@/utils/attendance/punchFolding';
import type { AttendanceEmployee, AttendanceRecord } from '@/utils/attendance/types';

interface RecordEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = add a new day record. */
  record: AttendanceRecord | null;
  employees: AttendanceEmployee[];
  onSaved: () => void;
}

/**
 * Corrects or adds one day's check-in / check-out.
 *
 * Saving marks the record `manuallyEdited`, which stops the device feed from
 * overwriting the correction with the device's original (wrong or missing) punch.
 */
const RecordEditDialog: React.FC<RecordEditDialogProps> = ({
  open,
  onOpenChange,
  record,
  employees,
  onSaved,
}) => {
  const isNew = !record;
  const [saving, setSaving] = useState(false);
  const [empCode, setEmpCode] = useState('');
  const [date, setDate] = useState(todayKey());
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  useEffect(() => {
    if (!open) return;
    setEmpCode(record?.empCode || employees[0]?.empCode || '');
    setDate(record?.date || todayKey());
    setCheckIn(record?.checkIn || '');
    setCheckOut(record?.checkOut || '');
  }, [open, record, employees]);

  const previewHours = hoursBetween(checkIn, checkOut);

  const handleSave = async () => {
    if (!empCode) {
      toast({ title: 'Select an employee', variant: 'destructive' });
      return;
    }
    if (!date) {
      toast({ title: 'Select a date', variant: 'destructive' });
      return;
    }
    if (!checkIn) {
      toast({ title: 'Check-in time is required', variant: 'destructive' });
      return;
    }

    const employee = employees.find((candidate) => candidate.empCode === empCode);

    setSaving(true);
    try {
      await saveRecordManually({
        empCode,
        employeeName: employee?.name || empCode,
        date,
        checkIn,
        checkOut: checkOut || undefined,
      });
      toast({ title: isNew ? 'Attendance added' : 'Attendance updated' });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add attendance' : 'Edit attendance'}</DialogTitle>
          <DialogDescription>
            Times are 24-hour. Once saved by hand, this day is protected from being
            overwritten by the next device sync.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="recordEmp">Employee</Label>
            <Select value={empCode} onValueChange={setEmpCode} disabled={!isNew}>
              <SelectTrigger id="recordEmp">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.empCode} value={employee.empCode}>
                    {employee.name} ({employee.empCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {employees.length === 0 && (
              <p className="text-xs text-amber-600">
                No employees yet. Add one from the Employees tab first.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recordDate">Date</Label>
            <Input
              id="recordDate"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={!isNew}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="checkIn">Check-in</Label>
              <Input
                id="checkIn"
                type="time"
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOut">Check-out</Label>
              <Input
                id="checkOut"
                type="time"
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/60">
            <span className="text-gray-600 dark:text-gray-400">Hours worked: </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {checkOut ? `${previewHours} hrs` : 'Not checked out yet'}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordEditDialog;
