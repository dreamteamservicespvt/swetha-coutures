import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Settings2, Trash2, Fingerprint } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { deleteEmployee } from '@/utils/attendance/attendanceStore';
import { formatCurrency } from '@/utils/attendance/salaryCalc';
import type { AttendanceEmployee, SalaryMode } from '@/utils/attendance/types';
import EmployeeSalaryDialog from './EmployeeSalaryDialog';

interface EmployeesTabProps {
  employees: AttendanceEmployee[];
  staffOptions: { id: string; name: string }[];
  loading: boolean;
  onChanged: () => void;
}

const MODE_LABEL: Record<SalaryMode, string> = {
  monthly: 'Monthly',
  daily: 'Daily wage',
  hourly: 'Per hour',
};

const MODE_SUFFIX: Record<SalaryMode, string> = {
  monthly: '/month',
  daily: '/day',
  hourly: '/hour',
};

const EmployeesTab: React.FC<EmployeesTabProps> = ({
  employees,
  staffOptions,
  loading,
  onChanged,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceEmployee | null>(null);

  const needsSetup = employees.filter((employee) => !employee.salaryMode || !employee.salaryAmount);

  const handleDelete = async (employee: AttendanceEmployee) => {
    if (
      !window.confirm(
        `Remove ${employee.name} from attendance?\n\nTheir past attendance records are kept. ` +
          `If they punch in again, they will be re-added automatically.`
      )
    ) {
      return;
    }
    try {
      await deleteEmployee(employee.empCode);
      toast({ title: 'Employee removed' });
      onChanged();
    } catch (error) {
      toast({
        title: 'Could not remove',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {needsSetup.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {needsSetup.length} employee{needsSetup.length === 1 ? '' : 's'} need a salary set
          </p>
          <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
            Until you set a pay basis, they count as ₹0 in payroll. Click the settings icon on their row.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {employees.length} employee{employees.length === 1 ? '' : 's'}
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add employee
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Pay basis</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Std hrs/day</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                      Loading employees…
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Fingerprint className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                      <p className="font-medium text-gray-700 dark:text-gray-300">No employees yet</p>
                      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                        Anyone who gives a fingerprint on the device appears here automatically once
                        their punches sync. You can also add someone by hand.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => {
                    const unset = !employee.salaryMode || !employee.salaryAmount;
                    return (
                      <TableRow key={employee.empCode} className={employee.active === false ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {employee.name}
                            </span>
                            {employee.active === false && (
                              <Badge variant="outline" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">Code {employee.empCode}</div>
                        </TableCell>
                        <TableCell>
                          {unset ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              Needs setup
                            </Badge>
                          ) : (
                            MODE_LABEL[employee.salaryMode!]
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {unset
                            ? '—'
                            : `${formatCurrency(employee.salaryAmount)}${MODE_SUFFIX[employee.salaryMode!]}`}
                        </TableCell>
                        <TableCell>{employee.standardHoursPerDay ?? 8}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {employee.source === 'device' ? 'Fingerprint' : 'Manual'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditing(employee);
                                setDialogOpen(true);
                              }}
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(employee)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EmployeeSalaryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
        staffOptions={staffOptions}
        onSaved={onChanged}
      />
    </div>
  );
};

export default EmployeesTab;
