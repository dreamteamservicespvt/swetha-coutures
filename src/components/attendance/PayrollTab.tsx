import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ChevronLeft, ChevronRight, Check, Undo2, Download, Wallet } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPayments, markPaid, undoPayment } from '@/utils/attendance/attendanceStore';
import {
  calculateSalary,
  formatCurrency,
  formatMonthLabel,
  monthBounds,
  toMonthKey,
} from '@/utils/attendance/salaryCalc';
import type { AttendanceEmployee, AttendanceRecord, SalaryPayment } from '@/utils/attendance/types';

interface PayrollTabProps {
  employees: AttendanceEmployee[];
  /** All records available to the page; this tab filters to the selected month itself. */
  allRecords: AttendanceRecord[];
  /** Asks the page to load records covering the given range. */
  onNeedRange: (start: string, end: string) => void;
}

function shiftMonth(periodKey: string, delta: number): string {
  const [year, month] = periodKey.split('-').map(Number);
  return toMonthKey(new Date(year, month - 1 + delta, 1));
}

const PayrollTab: React.FC<PayrollTabProps> = ({ employees, allRecords, onNeedRange }) => {
  const { userData } = useAuth();
  const [periodKey, setPeriodKey] = useState(() => toMonthKey(new Date()));
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const { start, end } = useMemo(() => monthBounds(periodKey), [periodKey]);

  const loadPayments = useCallback(async () => {
    try {
      setPayments(await fetchPayments(periodKey));
    } catch (error) {
      toast({
        title: 'Could not load payments',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [periodKey]);

  useEffect(() => {
    loadPayments();
    onNeedRange(start, end);
  }, [loadPayments, onNeedRange, start, end]);

  const paymentByCode = useMemo(() => {
    const map = new Map<string, SalaryPayment>();
    payments.forEach((payment) => map.set(payment.empCode, payment));
    return map;
  }, [payments]);

  const rows = useMemo(
    () =>
      employees
        .filter((employee) => employee.active !== false)
        .map((employee) => ({
          employee,
          breakdown: calculateSalary(employee, allRecords, start, end),
          payment: paymentByCode.get(employee.empCode),
        })),
    [employees, allRecords, start, end, paymentByCode]
  );

  const totals = useMemo(() => {
    const payable = rows.reduce((sum, row) => sum + row.breakdown.amount, 0);
    const paid = rows.reduce(
      (sum, row) => sum + (row.payment?.status === 'paid' ? row.payment.amount : 0),
      0
    );
    return { payable, paid, pending: payable - paid };
  }, [rows]);

  const handleMarkPaid = async (row: (typeof rows)[number]) => {
    if (row.breakdown.needsSetup) {
      toast({
        title: 'Set a salary first',
        description: `${row.employee.name} has no pay basis configured.`,
        variant: 'destructive',
      });
      return;
    }

    setBusyCode(row.employee.empCode);
    try {
      await markPaid({
        empCode: row.employee.empCode,
        employeeName: row.employee.name,
        periodKey,
        periodStart: start,
        periodEnd: end,
        amount: row.breakdown.amount,
        daysWorked: row.breakdown.daysWorked,
        hoursWorked: row.breakdown.hoursWorked,
        salaryMode: row.employee.salaryMode,
        paidBy: userData?.name || userData?.email || 'admin',
      });
      toast({
        title: 'Marked as paid',
        description: `${row.employee.name} — ${formatCurrency(row.breakdown.amount)}`,
      });
      await loadPayments();
    } catch (error) {
      toast({
        title: 'Could not mark paid',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusyCode(null);
    }
  };

  const handleUndo = async (row: (typeof rows)[number]) => {
    setBusyCode(row.employee.empCode);
    try {
      await undoPayment(row.employee.empCode, periodKey, userData?.name || userData?.email || 'admin');
      toast({ title: 'Payment undone', description: `${row.employee.name} is payable again.` });
      await loadPayments();
    } catch (error) {
      toast({
        title: 'Could not undo',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusyCode(null);
    }
  };

  const handleExport = async () => {
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((row) => ({
        Code: row.employee.empCode,
        Employee: row.employee.name,
        'Pay basis': row.employee.salaryMode || 'not set',
        Rate: row.employee.salaryAmount || 0,
        'Days worked': row.breakdown.daysWorked,
        'Hours worked': row.breakdown.hoursWorked,
        'Working days': row.breakdown.workingDays,
        Salary: row.breakdown.amount,
        Status: row.payment?.status === 'paid' ? 'Paid' : 'Pending',
        'Paid on': row.payment?.status === 'paid' ? row.payment.paidAt : '',
      }))
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Payroll');
    XLSX.writeFile(book, `payroll-${periodKey}.xlsx`);
    toast({ title: 'Payroll exported' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setPeriodKey(shiftMonth(periodKey, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center text-base font-semibold text-gray-900 dark:text-gray-100">
            {formatMonthLabel(periodKey)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPeriodKey(shiftMonth(periodKey, 1))}
            disabled={periodKey >= toMonthKey(new Date())}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Total payable</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(totals.payable)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Paid</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totals.paid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(totals.pending)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Calculation</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="text-right">Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Wallet className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                      <p className="font-medium text-gray-700 dark:text-gray-300">No active employees</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Employees appear here once they exist in the Employees tab.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const isPaid = row.payment?.status === 'paid';
                    const busy = busyCode === row.employee.empCode;
                    return (
                      <TableRow key={row.employee.empCode}>
                        <TableCell>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {row.employee.name}
                          </div>
                          <div className="text-xs text-gray-500">Code {row.employee.empCode}</div>
                        </TableCell>
                        <TableCell className="text-right">{row.breakdown.daysWorked}</TableCell>
                        <TableCell className="text-right">{row.breakdown.hoursWorked}</TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {row.breakdown.formula}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.breakdown.needsSetup ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              Needs setup
                            </Badge>
                          ) : (
                            formatCurrency(row.breakdown.amount)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isPaid ? (
                            <div className="flex items-center justify-end gap-2">
                              <Badge className="bg-green-600 hover:bg-green-600">
                                <Check className="mr-1 h-3 w-3" />
                                Paid {formatCurrency(row.payment!.amount)}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => handleUndo(row)}
                                title="Undo this payment"
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              disabled={busy || row.breakdown.needsSetup}
                              onClick={() => handleMarkPaid(row)}
                            >
                              {busy ? 'Saving…' : 'Mark paid'}
                            </Button>
                          )}
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

      <p className="text-xs text-gray-500">
        Salary is calculated from check-in and check-out records for {formatMonthLabel(periodKey)}.
        Monthly-paid employees are pro-rated by days present. Undo restores a row to payable and
        keeps the change on record.
      </p>
    </div>
  );
};

export default PayrollTab;
