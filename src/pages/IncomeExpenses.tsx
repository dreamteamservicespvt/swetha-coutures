
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { X, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import IncomeTab from '@/components/income-expenses/IncomeTab';
import ExpensesTab from '@/components/income-expenses/ExpensesTab';
import NetProfitChart from '@/components/income-expenses/NetProfitChart';
import CategoryBreakdown from '@/components/income-expenses/CategoryBreakdown';

interface StaffMember {
  id: string;
  name: string;
  salaryAmount?: number;
  salaryMode: 'monthly' | 'daily' | 'hourly';
  // New salary fields
  paidSalary?: number;
  bonus?: number;
  [key: string]: any;
}

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

  // Helper function to calculate monthly salary based on new logic
  const calculateMonthlySalary = (staff: StaffMember) => {
    const paidSalary = staff.paidSalary || 0;
    const bonus = staff.bonus || 0;
    const actualSalary = staff.salaryAmount || 0;
    
    // If both paid salary and bonus are entered, use their sum
    if (paidSalary > 0 && bonus > 0) {
      return paidSalary + bonus;
    }
    // If only paid salary is entered, use it
    if (paidSalary > 0) {
      return paidSalary;
    }
    // Otherwise, use actual salary
    return actualSalary;
  };

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
      
      // Calculate staff salaries expense
      try {
        const staffQuery = query(collection(db, 'staff'));
        const staffSnapshot = await getDocs(staffQuery);
        const staffMembers = staffSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StaffMember[];

        for (const staff of staffMembers) {
          const monthlySalaryAmount = calculateMonthlySalary(staff);
          if (!monthlySalaryAmount || monthlySalaryAmount <= 0) continue;

          let salaryAmount = 0;

          if (staff.salaryMode === 'monthly') {
            // For monthly salary, check if the date range includes any part of a month
            if (dateRange) {
              const monthsInRange = new Set();
              let currentDate = new Date(dateRange.start.toDate());
              while (currentDate <= dateRange.end.toDate()) {
                const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
                monthsInRange.add(monthKey);
                currentDate.setMonth(currentDate.getMonth() + 1);
              }
              salaryAmount = monthlySalaryAmount * monthsInRange.size;
            } else {
              // If no date range, use current month
              salaryAmount = monthlySalaryAmount;
            }
          } else {
            // For daily/hourly, calculate based on attendance
            let attendanceQuery = query(
              collection(db, 'attendance'),
              where('staffId', '==', staff.id),
              where('status', '==', 'confirmed')
            );
            
            if (dateRange) {
              attendanceQuery = query(
                collection(db, 'attendance'),
                where('staffId', '==', staff.id),
                where('status', '==', 'confirmed'),
                where('date', '>=', dateRange.start.toDate().toISOString().split('T')[0]),
                where('date', '<=', dateRange.end.toDate().toISOString().split('T')[0])
              ) as any;
            }
            
            const attendanceSnapshot = await getDocs(attendanceQuery);
            const attendanceCount = attendanceSnapshot.size;
            
            console.log(`Attendance records for ${staff.name} (${staff.salaryMode}):`, attendanceCount);
            
            if (staff.salaryMode === 'daily') {
              // If no attendance records but we're looking at current date, assume at least one day
              const workingDays = attendanceCount > 0 ? attendanceCount : 
                (dateRange ? 0 : 1); // Default to 1 day if no date range and no records
              
              if (workingDays > 0) {
                salaryAmount = monthlySalaryAmount * workingDays;
                console.log(`Daily salary calculation for ${staff.name}: ${workingDays} days × ₹${monthlySalaryAmount} = ₹${salaryAmount}`);
              }
            } else if (staff.salaryMode === 'hourly') {
              let totalHours = 0;
              
              if (attendanceCount > 0) {
                // Calculate based on actual attendance records
                attendanceSnapshot.docs.forEach(doc => {
                  const attendanceData = doc.data();
                  totalHours += attendanceData.hoursWorked || 8; // Default 8 hours if not specified
                });
              } else if (!dateRange) {
                // If no records but looking at current date, assume standard hours
                totalHours = 8; // Default to 8 hours if no date range specified
              }
              
              if (totalHours > 0) {
                salaryAmount = monthlySalaryAmount * totalHours;
                console.log(`Hourly salary calculation for ${staff.name}: ${totalHours} hours × ₹${monthlySalaryAmount} = ₹${salaryAmount}`);
              }
            }
          }

          totalExpenses += salaryAmount;
        }
      } catch (error) {
        console.error('Error calculating staff salaries:', error);
      }
      
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="tracking">
            <BarChart3 className="h-4 w-4 mr-2" />
            Tracking
          </TabsTrigger>
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
                  dateRange={getDateRange()} 
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
                  dateRange={getDateRange()} 
                  onBack={() => {}} 
                  inline={true}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Net Profit Chart */}
      <NetProfitChart financialData={financialData} />
    </div>
  );
};

export default IncomeExpenses;
