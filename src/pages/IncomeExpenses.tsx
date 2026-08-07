
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { X, TrendingUp, TrendingDown, BarChart3, CalendarDays, Calculator, ChevronDown, ChevronRight, HandCoins } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { getFinancialSummary } from '@/utils/financeReports';
import IncomeTab from '@/components/income-expenses/IncomeTab';
import ExpensesTab from '@/components/income-expenses/ExpensesTab';
import NetProfitChart from '@/components/income-expenses/NetProfitChart';
import CategoryBreakdown from '@/components/income-expenses/CategoryBreakdown';
import AccountsTab from '@/components/income-expenses/AccountsTab';
import QuickRangeToggle, { QuickRange } from '@/components/QuickRangeToggle';

const IncomeExpenses = () => {
  const [activeTab, setActiveTab] = useState('income');
  // Quick date range toggle — Career / This Month / Today, defaults to This Month
  const [quickRange, setQuickRange] = useState<QuickRange>('month');
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  // Collapsed by default so small screens keep their vertical space (Req 4)
  const [filtersOpen, setFiltersOpen] = useState(false);

  // A custom date selection overrides the quick toggle
  const hasCustomDate = !!(singleDate || (startDate && endDate));

  // Human label for the active period (used by the Accounts/CA export)
  const periodLabel = hasCustomDate
    ? 'Selected dates'
    : quickRange === 'career'
      ? 'Career (all time)'
      : quickRange === 'today'
        ? 'Today'
        : 'This Month';
  const [financialData, setFinancialData] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalBilling: 0,
    uncollected: 0,
    incomeData: [],
    expenseData: []
  });

  const clearFilters = () => {
    setSingleDate(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // Memoised so the SAME object reference is reused until the actual range changes.
  // This stops every child tab from refetching on each parent re-render (was causing flicker).
  const dateRange = useMemo<{ start: Timestamp; end: Timestamp } | null>(() => {
    // Custom date selections always override the quick toggle
    if (singleDate) {
      const start = new Date(singleDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(singleDate);
      end.setHours(23, 59, 59, 999);
      return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
    }

    // Otherwise use the quick toggle
    const now = new Date();
    if (quickRange === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
    }

    if (quickRange === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
    }

    return null; // 'career' => all-time
  }, [quickRange, singleDate, startDate, endDate]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // Single shared source of truth (client-side date filtering) so the headline cards always
      // match the Income/Expense tab totals, the Tracking tab and the Accounts/CA export.
      const { totalIncome, totalExpenses, netProfit, totalBilling, uncollected } =
        await getFinancialSummary(dateRange);
      setFinancialData({
        totalIncome,
        totalExpenses,
        netProfit,
        totalBilling,
        uncollected,
        incomeData: [],
        expenseData: [],
      });
    } catch (error) {
      console.error('Error fetching financial data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch financial data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  return (
    <div className="mobile-page-layout">
      <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">Income &amp; Expenses</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Income counts money actually <b>collected</b>, not billed
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Income Collected</CardTitle>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-green-600 break-words">₹{financialData.totalIncome.toLocaleString()}</div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Cash in hand + online received</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Yet to Collect</CardTitle>
            <HandCoins className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-amber-600 break-words">₹{financialData.uncollected.toLocaleString()}</div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Billed ₹{financialData.totalBilling.toLocaleString()} in this period
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-600 break-words">₹{financialData.totalExpenses.toLocaleString()}</div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Materials, salaries &amp; custom</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Net Profit</CardTitle>
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl sm:text-2xl font-bold break-words ${financialData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {financialData.netProfit < 0
                ? `-₹${Math.abs(financialData.netProfit).toLocaleString()}`
                : `₹${financialData.netProfit.toLocaleString()}`}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Collected income − expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Filters — collapsed by default to free up screen space (Req 4) */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="min-w-0">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-purple-600" />
                Date Filters
              </CardTitle>
              <CardDescription className="mt-1 truncate">
                Showing <span className="font-medium text-gray-700 dark:text-gray-200">{periodLabel}</span>
                {' · '}tap to change
              </CardDescription>
            </span>
            {filtersOpen ? (
              <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" />
            )}
          </button>
        </CardHeader>
        {filtersOpen && (
          <CardContent className="space-y-4">
            {/* Quick view toggle — Career / This Month / Today */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Quick view:</span>
              <QuickRangeToggle value={quickRange} onChange={setQuickRange} muted={hasCustomDate} />
              {hasCustomDate && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Custom date active — overrides quick view
                </span>
              )}
            </div>

            {/* Custom date filter — placeholders convey each field, so no labels needed */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <DatePicker
                  date={singleDate}
                  onDateChange={setSingleDate}
                  placeholder="Pick a date"
                  className="w-full"
                />
                <DatePicker
                  date={startDate}
                  onDateChange={setStartDate}
                  placeholder="Start date"
                  className="w-full"
                />
                <DatePicker
                  date={endDate}
                  onDateChange={setEndDate}
                  placeholder="End date"
                  className="w-full"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasCustomDate}
                  className="w-full justify-center"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear dates
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="income" className="text-xs sm:text-sm">Income</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs sm:text-sm">Expenses</TabsTrigger>
          <TabsTrigger value="tracking" className="text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
            Tracking
          </TabsTrigger>
          <TabsTrigger value="accounts" className="text-xs sm:text-sm">
            <Calculator className="h-4 w-4 mr-1 sm:mr-2" />
            Accounts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-6">
          <IncomeTab 
            dateRange={dateRange} 
            onDataChange={fetchFinancialData}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <ExpensesTab 
            dateRange={dateRange} 
            onDataChange={fetchFinancialData}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="tracking" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                  Income Categories
                </CardTitle>
                <CardDescription>
                  Breakdown of income sources by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBreakdown 
                  type="income" 
                  dateRange={dateRange} 
                  onBack={() => {}} 
                  inline={true}
                />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
                  Expense Categories
                </CardTitle>
                <CardDescription>
                  Breakdown of expenses by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBreakdown
                  type="expense"
                  dateRange={dateRange}
                  onBack={() => {}}
                  inline={true}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          <AccountsTab dateRange={dateRange} periodLabel={periodLabel} />
        </TabsContent>
      </Tabs>

      {/* Net Profit Chart */}
      <NetProfitChart financialData={financialData} />
      </div>
    </div>
  );
};

export default IncomeExpenses;
