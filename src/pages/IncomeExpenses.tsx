
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { X, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import IncomeTab from '@/components/income-expenses/IncomeTab';
import ExpensesTab from '@/components/income-expenses/ExpensesTab';
import NetProfitChart from '@/components/income-expenses/NetProfitChart';

const IncomeExpenses = () => {
  const [activeTab, setActiveTab] = useState('income');
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
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

  const getDateRange = () => {
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
    
    return null;
  };

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange();
      let totalIncome = 0;
      let totalExpenses = 0;
      
      // Fetch bills for income (using the new 'bills' collection)
      let billsQuery = collection(db, 'bills');
      if (dateRange) {
        billsQuery = query(
          collection(db, 'bills'),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end)
        ) as any;
      }
      
      const billsSnapshot = await getDocs(billsQuery);
      const billsIncome = billsSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.totalAmount || 0);
      }, 0);
      
      totalIncome += billsIncome;
      
      // Calculate expenses from Cost of Goods Sold (COGS) - from bill items
      const cogsExpenses = billsSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        if (data.items && Array.isArray(data.items)) {
          const itemsCost = data.items.reduce((itemSum: number, item: any) => {
            // Calculate cost for each item type
            const itemCost = (item.cost || 0) * (item.quantity || 1);
            return itemSum + itemCost;
          }, 0);
          return sum + itemsCost;
        }
        return sum;
      }, 0);
      
      totalExpenses += cogsExpenses;
      
      // Fetch legacy billing data for backward compatibility
      let legacyBillingQuery = collection(db, 'billing');
      if (dateRange) {
        legacyBillingQuery = query(
          collection(db, 'billing'),
          where('createdAt', '>=', dateRange.start),
          where('createdAt', '<=', dateRange.end)
        ) as any;
      }
      
      const legacyBillingSnapshot = await getDocs(legacyBillingQuery);
      const legacyBillingIncome = legacyBillingSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.totalAmount || 0);
      }, 0);
      
      totalIncome += legacyBillingIncome;
      
      // Fetch custom income
      let incomeQuery = collection(db, 'income');
      if (dateRange) {
        incomeQuery = query(
          collection(db, 'income'),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end)
        ) as any;
      }
      
      const incomeSnapshot = await getDocs(incomeQuery);
      const customIncome = incomeSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.amount || 0);
      }, 0);
      
      totalIncome += customIncome;
      
      // Fetch custom expenses (operational expenses not related to sales)
      let expensesQuery = collection(db, 'expenses');
      if (dateRange) {
        expensesQuery = query(
          collection(db, 'expenses'),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end)
        ) as any;
      }
      
      const expensesSnapshot = await getDocs(expensesQuery);
      const customExpenses = expensesSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.amount || 0);
      }, 0);
      
      totalExpenses += customExpenses;
      
      // Fetch inventory purchases for expenses (only if not in date range or for reference)
      let inventoryQuery = collection(db, 'inventory');
      if (dateRange) {
        inventoryQuery = query(
          collection(db, 'inventory'),
          where('broughtAt', '>=', dateRange.start),
          where('broughtAt', '<=', dateRange.end)
        ) as any;
      }
      
      const inventorySnapshot = await getDocs(inventoryQuery);
      const inventoryCosts = inventorySnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.cost || 0);
      }, 0);
      
      // Only add inventory costs if COGS is zero (for backward compatibility)
      if (cogsExpenses === 0) {
        totalExpenses += inventoryCosts;
      }
      
      setFinancialData({
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        incomeData: [...billsSnapshot.docs, ...legacyBillingSnapshot.docs, ...incomeSnapshot.docs],
        expenseData: [...expensesSnapshot.docs, ...(cogsExpenses === 0 ? inventorySnapshot.docs : [])]
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
  }, [singleDate, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Income & Expenses</h1>
          <p className="text-gray-600">Track your business financial performance</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Income</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{financialData.totalIncome.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Expenses</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">₹{financialData.totalExpenses.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Net Profit</CardTitle>
            <DollarSign className={`h-5 w-5 ${financialData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${financialData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{financialData.netProfit.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Filters */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Date Filters</CardTitle>
          <CardDescription>Filter data by specific date or date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Single Date</Label>
              <DatePicker
                date={singleDate}
                onDateChange={setSingleDate}
                placeholder="Pick a date"
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <DatePicker
                date={startDate}
                onDateChange={setStartDate}
                placeholder="Start date"
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <DatePicker
                date={endDate}
                onDateChange={setEndDate}
                placeholder="End date"
                className="w-[180px]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="mb-0"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-6">
          <IncomeTab 
            dateRange={getDateRange()} 
            onDataChange={fetchFinancialData}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <ExpensesTab 
            dateRange={getDateRange()} 
            onDataChange={fetchFinancialData}
            loading={loading}
          />
        </TabsContent>
      </Tabs>

      {/* Net Profit Chart */}
      <NetProfitChart financialData={financialData} />
    </div>
  );
};

export default IncomeExpenses;
