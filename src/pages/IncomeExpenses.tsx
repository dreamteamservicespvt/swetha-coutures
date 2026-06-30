
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { X, TrendingUp, TrendingDown, BarChart3, CalendarDays, Calculator } from 'lucide-react';
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
      const { totalIncome, totalExpenses, netProfit } = await getFinancialSummary(dateRange);
      setFinancialData({
        totalIncome,
        totalExpenses,
        netProfit,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Income &amp; Expenses</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Track your business financial performance</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Income</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{financialData.totalIncome.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">₹{financialData.totalExpenses.toLocaleString()}</div>
            <div className="text-sm text-gray-500 mt-2">
              Net Profit: <span className={`font-medium ${financialData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {financialData.netProfit < 0 ? 
                  `-₹${Math.abs(financialData.netProfit).toLocaleString()}` : 
                  `₹${financialData.netProfit.toLocaleString()}`
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Filters */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            Date Filters
          </CardTitle>
          <CardDescription>Pick a quick range, or set a specific date / custom range</CardDescription>
        </CardHeader>
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
                className="w-full sm:w-auto justify-center"
              >
                <X className="h-4 w-4 mr-1" />
                Clear dates
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="tracking">
            <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
            Tracking
          </TabsTrigger>
          <TabsTrigger value="accounts">
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
  );
};

export default IncomeExpenses;
