import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, TrendingUp, TrendingDown, Receipt, Loader2, Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toast } from '@/hooks/use-toast';
import {
  getCategoryData,
  getTotalBilling,
  toJsDate,
  FinanceCategory,
  FinanceDateRange,
} from '@/utils/financeReports';

interface AccountsTabProps {
  dateRange: FinanceDateRange;
  periodLabel: string;
}

const formatINR = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const fmtDate = (d: any) => {
  const date = toJsDate(d);
  if (!date || date.getFullYear() <= 1970) return 'N/A';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const incomeDescription = (e: any) =>
  e?.type === 'billing'
    ? `${e.billNumber || 'Bill'} - ${e.customerName || 'Customer'}${e.instalment ? ` (${e.instalment})` : ''}`
    : e?.sourceName || 'Income Entry';

const expenseDescription = (e: any) =>
  e?.type === 'salary'
    ? e.expenseName || `${e.staffName || 'Staff'} Salary`
    : e?.type === 'inventory'
      ? e.itemName || 'Material Item'
      : e?.expenseName || 'Expense Entry';

const AccountsTab: React.FC<AccountsTabProps> = ({ dateRange, periodLabel }) => {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [incomeCats, setIncomeCats] = useState<FinanceCategory[]>([]);
  const [expenseCats, setExpenseCats] = useState<FinanceCategory[]>([]);
  const [totalBilling, setTotalBilling] = useState(0);
  // category name -> included?  (default all included)
  const [includedIncome, setIncludedIncome] = useState<Record<string, boolean>>({});
  const [includedExpense, setIncludedExpense] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [inc, exp, billing] = await Promise.all([
          getCategoryData('income', dateRange),
          getCategoryData('expense', dateRange),
          getTotalBilling(dateRange),
        ]);
        if (cancelled) return;
        setIncomeCats(inc);
        setExpenseCats(exp);
        setTotalBilling(billing);
        // Default: include every category
        setIncludedIncome(Object.fromEntries(inc.map((c) => [c.name, true])));
        setIncludedExpense(Object.fromEntries(exp.map((c) => [c.name, true])));
      } catch (error) {
        console.error('Error loading accounts data:', error);
        toast({ title: 'Error', description: 'Failed to load accounts data', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange]);

  const incomeTotal = useMemo(
    () => incomeCats.filter((c) => includedIncome[c.name]).reduce((s, c) => s + c.total, 0),
    [incomeCats, includedIncome]
  );
  const expenseTotal = useMemo(
    () => expenseCats.filter((c) => includedExpense[c.name]).reduce((s, c) => s + c.total, 0),
    [expenseCats, includedExpense]
  );
  const netProfit = incomeTotal - expenseTotal;

  const setAll = (type: 'income' | 'expense', value: boolean) => {
    if (type === 'income') {
      setIncludedIncome(Object.fromEntries(incomeCats.map((c) => [c.name, value])));
    } else {
      setIncludedExpense(Object.fromEntries(expenseCats.map((c) => [c.name, value])));
    }
  };

  const rangeStrings = () => {
    if (!dateRange) return { from: 'All time', to: 'All time' };
    return {
      from: dateRange.start.toDate().toLocaleDateString('en-IN'),
      to: dateRange.end.toDate().toLocaleDateString('en-IN'),
    };
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const incList = incomeCats.filter((c) => includedIncome[c.name]);
      const expList = expenseCats.filter((c) => includedExpense[c.name]);
      const { from, to } = rangeStrings();
      const wb = XLSX.utils.book_new();

      // --- Summary sheet ---
      const summary = [
        ["Swetha's Couture — Accounts Summary"],
        [],
        ['Period', periodLabel],
        ['From', from],
        ['To', to],
        ['Generated on', new Date().toLocaleString('en-IN')],
        [],
        ['Total Billing Amount', totalBilling],
        ['Total Income (selected)', incomeTotal],
        ['Total Expenses (selected)', expenseTotal],
        ['Net Profit', netProfit],
        [],
        ['Income categories included', `${incList.length} of ${incomeCats.length}`],
        ['Expense categories included', `${expList.length} of ${expenseCats.length}`],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summary);
      wsSummary['!cols'] = [{ wch: 28 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // --- Income sheet ---
      const incomeRows: any[][] = [['Category', 'Entries', 'Amount (₹)']];
      incList.forEach((c) => incomeRows.push([c.name, c.count, c.total]));
      incomeRows.push(['TOTAL', incList.reduce((s, c) => s + c.count, 0), incomeTotal]);
      const wsIncome = XLSX.utils.aoa_to_sheet(incomeRows);
      wsIncome['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsIncome, 'Income');

      // --- Expenses sheet ---
      const expenseRows: any[][] = [['Category', 'Entries', 'Amount (₹)']];
      expList.forEach((c) => expenseRows.push([c.name, c.count, c.total]));
      expenseRows.push(['TOTAL', expList.reduce((s, c) => s + c.count, 0), expenseTotal]);
      const wsExpense = XLSX.utils.aoa_to_sheet(expenseRows);
      wsExpense['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsExpense, 'Expenses');

      // --- Income details ---
      const incDetail: any[][] = [['Date', 'Description', 'Category', 'Amount (₹)']];
      incList.forEach((c) =>
        [...c.entries]
          .sort((a, b) => toJsDate(b.date).getTime() - toJsDate(a.date).getTime())
          .forEach((e) => incDetail.push([fmtDate(e.date), incomeDescription(e), c.name, e.amount || 0]))
      );
      const wsIncDetail = XLSX.utils.aoa_to_sheet(incDetail);
      wsIncDetail['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 26 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsIncDetail, 'Income Details');

      // --- Expense details ---
      const expDetail: any[][] = [['Date', 'Description', 'Category', 'Amount (₹)']];
      expList.forEach((c) =>
        [...c.entries]
          .sort((a, b) => toJsDate(b.date).getTime() - toJsDate(a.date).getTime())
          .forEach((e) => expDetail.push([fmtDate(e.date), expenseDescription(e), c.name, e.amount || 0]))
      );
      const wsExpDetail = XLSX.utils.aoa_to_sheet(expDetail);
      wsExpDetail['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 26 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsExpDetail, 'Expense Details');

      const safePeriod = periodLabel.replace(/[^a-zA-Z0-9]+/g, '-');
      const filename = `Accounts_${safePeriod}_${new Date().toISOString().split('T')[0]}.xlsx`;
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        filename
      );

      toast({ title: 'Export ready', description: `Accounts exported to ${filename}` });
    } catch (error) {
      console.error('Error exporting accounts:', error);
      toast({ title: 'Export failed', description: 'Could not generate the Excel file', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const CategoryList = ({
    title,
    icon,
    cats,
    included,
    onToggle,
    onAll,
    accent,
  }: {
    title: string;
    icon: React.ReactNode;
    cats: FinanceCategory[];
    included: Record<string, boolean>;
    onToggle: (name: string) => void;
    onAll: (v: boolean) => void;
    accent: 'green' | 'red';
  }) => {
    const selectedCount = cats.filter((c) => included[c.name]).length;
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base sm:text-lg">
            <span className="flex items-center gap-2">
              {icon}
              {title}
            </span>
            <Badge variant="secondary" className="text-xs">
              {selectedCount}/{cats.length}
            </Badge>
          </CardTitle>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onAll(true)}>
              Select all
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onAll(false)}>
              Clear all
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {cats.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No categories in this period.</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1 scrollbar-thin">
              {cats.map((c) => (
                <label
                  key={c.name}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Checkbox checked={!!included[c.name]} onCheckedChange={() => onToggle(c.name)} />
                    <span className="text-sm truncate">{c.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">({c.count})</span>
                  </span>
                  <span className={`text-sm font-semibold shrink-0 ${accent === 'green' ? 'text-green-600' : 'text-red-600'}`}>
                    {formatINR(c.total)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        Loading accounts…
      </div>
    );
  }

  const { from, to } = rangeStrings();

  return (
    <div className="space-y-6">
      {/* Summary + export */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Calculator className="h-5 w-5 text-purple-600" />
                Accounts (for CA / Export)
              </CardTitle>
              <CardDescription className="mt-1">
                Period: <span className="font-medium text-gray-700 dark:text-gray-200">{periodLabel}</span>
                {dateRange && (
                  <span className="text-gray-500 dark:text-gray-400">
                    {' '}
                    ({from} – {to})
                  </span>
                )}
              </CardDescription>
            </div>
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white w-full lg:w-auto"
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Export to Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg bg-white dark:bg-gray-800 p-3 shadow-sm">
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Receipt className="h-3.5 w-3.5" /> Total Billing
              </div>
              <div className="text-lg sm:text-xl font-bold text-purple-600 mt-1">{formatINR(totalBilling)}</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 p-3 shadow-sm">
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <TrendingUp className="h-3.5 w-3.5" /> Income (selected)
              </div>
              <div className="text-lg sm:text-xl font-bold text-green-600 mt-1">{formatINR(incomeTotal)}</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 p-3 shadow-sm">
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <TrendingDown className="h-3.5 w-3.5" /> Expenses (selected)
              </div>
              <div className="text-lg sm:text-xl font-bold text-red-600 mt-1">{formatINR(expenseTotal)}</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 p-3 shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400">Net Profit</div>
              <div className={`text-lg sm:text-xl font-bold mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netProfit < 0 ? `-${formatINR(Math.abs(netProfit))}` : formatINR(netProfit)}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Tick the categories to include in the totals and the export. The quick view / date filters above control the period.
          </p>
        </CardContent>
      </Card>

      {/* Category include/exclude controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryList
          title="Income Categories"
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          cats={incomeCats}
          included={includedIncome}
          onToggle={(name) => setIncludedIncome((p) => ({ ...p, [name]: !p[name] }))}
          onAll={(v) => setAll('income', v)}
          accent="green"
        />
        <CategoryList
          title="Expense Categories"
          icon={<TrendingDown className="h-5 w-5 text-red-600" />}
          cats={expenseCats}
          included={includedExpense}
          onToggle={(name) => setIncludedExpense((p) => ({ ...p, [name]: !p[name] }))}
          onAll={(v) => setAll('expense', v)}
          accent="red"
        />
      </div>
    </div>
  );
};

export default AccountsTab;
