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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { createManualEmployee, saveEmployee } from '@/utils/attendance/attendanceStore';
import type { AttendanceEmployee, SalaryMode } from '@/utils/attendance/types';

interface EmployeeSalaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new employee by hand (someone yet to give a fingerprint). */
  employee: AttendanceEmployee | null;
  staffOptions: { id: string; name: string }[];
  onSaved: () => void;
}

const MODE_HELP: Record<SalaryMode, string> = {
  monthly: 'Monthly salary, pro-rated by the days actually present (÷ working days × days present).',
  daily: 'A fixed wage for every day the employee checks in.',
  hourly: 'Rate multiplied by the hours between check-in and check-out.',
};

const MODE_LABEL: Record<SalaryMode, string> = {
  monthly: 'Monthly salary',
  daily: 'Daily wage',
  hourly: 'Rate per hour',
};

/** Sets a person's pay basis. Also serves as the "add employee by hand" form. */
const EmployeeSalaryDialog: React.FC<EmployeeSalaryDialogProps> = ({
  open,
  onOpenChange,
  employee,
  staffOptions,
  onSaved,
}) => {
  const isNew = !employee;
  const [saving, setSaving] = useState(false);
  const [empCode, setEmpCode] = useState('');
  const [name, setName] = useState('');
  const [salaryMode, setSalaryMode] = useState<SalaryMode | ''>('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [standardHours, setStandardHours] = useState('8');
  const [active, setActive] = useState(true);
  const [linkedStaffId, setLinkedStaffId] = useState('');

  useEffect(() => {
    if (!open) return;
    setEmpCode(employee?.empCode || '');
    setName(employee?.name || '');
    setSalaryMode(employee?.salaryMode || '');
    setSalaryAmount(employee?.salaryAmount ? String(employee.salaryAmount) : '');
    setStandardHours(String(employee?.standardHoursPerDay ?? 8));
    setActive(employee?.active ?? true);
    setLinkedStaffId(employee?.linkedStaffId || '');
  }, [open, employee]);

  const handleSave = async () => {
    const trimmedCode = empCode.trim();
    const trimmedName = name.trim();

    if (isNew && !trimmedCode) {
      toast({ title: 'Employee code required', description: 'Use the same code as the fingerprint device.', variant: 'destructive' });
      return;
    }
    if (!trimmedName) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }

    const amount = parseFloat(salaryAmount);
    if (salaryMode && (Number.isNaN(amount) || amount < 0)) {
      toast({ title: 'Enter a valid salary amount', variant: 'destructive' });
      return;
    }

    const hours = parseFloat(standardHours);
    if (Number.isNaN(hours) || hours <= 0 || hours > 24) {
      toast({ title: 'Standard hours must be between 1 and 24', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await createManualEmployee({
          empCode: trimmedCode,
          name: trimmedName,
          salaryMode: (salaryMode || null) as SalaryMode | null,
          salaryAmount: salaryMode ? amount : 0,
          standardHoursPerDay: hours,
        });
      } else {
        await saveEmployee(employee!.empCode, {
          name: trimmedName,
          salaryMode: (salaryMode || null) as SalaryMode | null,
          salaryAmount: salaryMode ? amount : 0,
          standardHoursPerDay: hours,
          active,
          linkedStaffId: linkedStaffId || '',
        });
      }

      toast({ title: isNew ? 'Employee added' : 'Salary settings saved' });
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
          <DialogTitle>{isNew ? 'Add employee' : `Salary — ${employee?.name}`}</DialogTitle>
          <DialogDescription>
            {isNew
              ? 'Add someone who has not given a fingerprint yet. Use the same employee code the device will use, so their punches link up automatically.'
              : 'Set how this employee is paid. Salary is calculated from their check-in and check-out records.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="empCode">Employee code</Label>
            <Input
              id="empCode"
              value={empCode}
              onChange={(event) => setEmpCode(event.target.value)}
              disabled={!isNew}
              placeholder="e.g. 1"
            />
            {!isNew && (
              <p className="text-xs text-gray-500">Set by the fingerprint device — cannot be changed.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="empName">Name</Label>
            <Input
              id="empName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Employee name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salaryMode">Pay basis</Label>
            <Select value={salaryMode} onValueChange={(value) => setSalaryMode(value as SalaryMode)}>
              <SelectTrigger id="salaryMode">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{MODE_LABEL.monthly}</SelectItem>
                <SelectItem value="daily">{MODE_LABEL.daily}</SelectItem>
                <SelectItem value="hourly">{MODE_LABEL.hourly}</SelectItem>
              </SelectContent>
            </Select>
            {salaryMode && <p className="text-xs text-gray-500">{MODE_HELP[salaryMode]}</p>}
          </div>

          {salaryMode && (
            <div className="space-y-2">
              <Label htmlFor="salaryAmount">
                {salaryMode === 'monthly'
                  ? 'Monthly salary (₹)'
                  : salaryMode === 'daily'
                    ? 'Daily wage (₹)'
                    : 'Rate per hour (₹)'}
              </Label>
              <Input
                id="salaryAmount"
                type="number"
                inputMode="decimal"
                min="0"
                value={salaryAmount}
                onChange={(event) => setSalaryAmount(event.target.value)}
                placeholder="0"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="standardHours">Standard hours per day</Label>
            <Input
              id="standardHours"
              type="number"
              inputMode="decimal"
              min="1"
              max="24"
              value={standardHours}
              onChange={(event) => setStandardHours(event.target.value)}
            />
            <p className="text-xs text-gray-500">Used as a reference for a normal working day.</p>
          </div>

          {!isNew && (
            <>
              <div className="space-y-2">
                <Label htmlFor="linkedStaff">Link to staff member (optional)</Label>
                <Select
                  value={linkedStaffId || 'none'}
                  onValueChange={(value) => setLinkedStaffId(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="linkedStaff">
                    <SelectValue placeholder="Not linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked</SelectItem>
                    {staffOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Purely a cross-reference to your existing Staff list. It does not change staff salary or expenses.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="active" className="cursor-pointer">Active</Label>
                  <p className="text-xs text-gray-500">Inactive employees are hidden from payroll.</p>
                </div>
                <Switch id="active" checked={active} onCheckedChange={setActive} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add employee' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeSalaryDialog;
