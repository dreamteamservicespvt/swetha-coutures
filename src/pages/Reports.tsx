
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Users, ShoppingCart, Calendar, Download } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { getFinancialSummary, getMonthlySeries, FinanceCategory } from '@/utils/financeReports';
import { fetchDocsCached } from '@/utils/firestoreCache';

interface ReportData {
  orders: any[];
  customers: any[];
  expenses: any[];
  inventory: any[];
  staff: any[];
  appointments: any[];
}

const Reports = () => {
  const { userData } = useAuth();
  const [data, setData] = useState<ReportData>({
    orders: [],
    customers: [],
    expenses: [],
    inventory: [],
    staff: [],
    appointments: []
  });
  const [loading, setLoading] = useState(true);
  /**
   * Finance figures come from the shared finance layer, not from this page's own maths.
   * Reports used to define revenue as "orders marked delivered", which reported ₹0 and a
   * large loss while Income & Expenses showed real collected income — two contradictory
   * profit figures in one app is worse than none.
   */
  const [finance, setFinance] = useState({ totalIncome: 0, totalExpenses: 0, netProfit: 0, totalBilling: 0, uncollected: 0 });
  const [expenseCats, setExpenseCats] = useState<FinanceCategory[]>([]);
  const [monthlySeries, setMonthlySeries] = useState<{ month: string; revenue: number; expenses: number; orders: number }[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchReportsData();
  }, [dateRange]);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      
      // Everything in parallel, through the shared cache. These used to run one after
      // another — six collection reads, then the summary, then the categories, then the
      // monthly series — which left the page on its skeleton for well over ten seconds.
      const year = new Date().getFullYear();
      const start = new Date(dateRange.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);
      const range = { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };

      const [orders, customers, expensesData, inventory, staff, appointments, summary, series] =
        await Promise.all([
          fetchDocsCached('orders'),
          fetchDocsCached('customers'),
          fetchDocsCached('expenses'),
          fetchDocsCached('inventory'),
          fetchDocsCached('staff'),
          fetchDocsCached('appointments'),
          getFinancialSummary(range),
          getMonthlySeries(year),
        ]);
      const expenseCategories = summary.expenseCategories;

      const results = { orders, customers, expenses: expensesData, inventory, staff, appointments };
      setData(results as any);
      setFinance(summary);
      setExpenseCats(expenseCategories);
      setMonthlySeries(
        series.map((point, month) => ({
          ...point,
          orders: orders.filter((order: any) => {
            const raw = order.orderDate || order.createdAt;
            if (!raw) return false;
            const date = raw?.toDate ? raw.toDate() : new Date(raw);
            return date.getFullYear() === year && date.getMonth() === month;
          }).length,
        }))
      );
    } catch (error) {
      console.error('Error fetching reports data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reports data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterByDateRange = (items: any[], dateField: string = 'createdAt') => {
    return items.filter(item => {
      if (!item[dateField]) return false;
      
      let itemDate;
      if (item[dateField].toDate) {
        itemDate = item[dateField].toDate();
      } else if (typeof item[dateField] === 'string') {
        itemDate = new Date(item[dateField]);
      } else {
        return false;
      }
      
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);
      
      return itemDate >= start && itemDate <= end;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Calculate metrics
  const filteredOrders = filterByDateRange(data.orders);
  const filteredExpenses = filterByDateRange(data.expenses, 'date');
  const filteredCustomers = filterByDateRange(data.customers);
  const filteredAppointments = filterByDateRange(data.appointments, 'appointmentDate');

  const totalRevenue = finance.totalIncome;
  const totalExpenses = finance.totalExpenses;
  const netProfit = finance.netProfit;

  const totalOrders = filteredOrders.length;
  const newCustomers = filteredCustomers.length;
  const completedAppointments = filteredAppointments.filter(apt => apt.status === 'completed').length;

  // Chart data — revenue per month is *collected* income, matching the cards above.
  const monthlyData = monthlySeries.length > 0 ? monthlySeries : [];
  // Zero-value slices are filtered out: recharts still draws their labels, and four of them
  // land on the same spot, producing the unreadable "Ready 0%Delivered 0%" pile-up.
  const orderStatusData = [
    { name: 'Received', value: data.orders.filter(o => o.status === 'received').length, color: '#8884d8' },
    { name: 'In Progress', value: data.orders.filter(o => o.status === 'in-progress').length, color: '#82ca9d' },
    { name: 'Ready', value: data.orders.filter(o => o.status === 'ready').length, color: '#ffc658' },
    { name: 'Delivered', value: data.orders.filter(o => o.status === 'delivered').length, color: '#ff7c7c' }
  ].filter((slice) => slice.value > 0);

  // Expense records have no `type` field — the old grouping produced a chart of `undefined`,
  // which is why "Top Expense Categories" always rendered empty.
  const expenseTypeData = expenseCats
    .slice(0, 5)
    .map((category) => ({ name: category.name, value: category.total }));

  return (
    <div className="mobile-page-layout">
      <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">Reports &amp; Analytics</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Business insights and performance metrics</p>
        </div>
        <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Date Range Filter</CardTitle>
          <CardDescription>Select date range for detailed analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex-1">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Collected · ₹{finance.uncollected.toLocaleString()} still to collect
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</CardTitle>
            <TrendingUp className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Materials, salaries &amp; custom</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Profit</CardTitle>
            <TrendingUp className={`h-5 w-5 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{netProfit.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Collected income − expenses</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Orders</CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalOrders}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">In selected period</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Monthly Revenue vs Expenses */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Monthly Revenue vs Expenses</CardTitle>
            <CardDescription>Year-to-date comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                <Bar dataKey="expenses" fill="#82ca9d" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Order Status Distribution</CardTitle>
            <CardDescription>Current order pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            {orderStatusData.length === 0 ? (
              <p className="py-24 text-center text-sm text-gray-500">No orders in the system yet.</p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {orderStatusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any, name: any) => [`${value} order(s)`, name]} />
                  </PieChart>
                </ResponsiveContainer>

                {/* An explicit legend rather than labels drawn on the slices: slice labels
                    collide when several statuses are close in size, and are unreadable on a
                    phone. */}
                <div className="w-full shrink-0 space-y-1.5 sm:w-44">
                  {orderStatusData.map((entry) => {
                    const total = orderStatusData.reduce((sum, item) => sum + item.value, 0) || 1;
                    return (
                      <div key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-sm"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="truncate">{entry.name}</span>
                        </span>
                        <span className="shrink-0 font-medium">
                          {entry.value}
                          <span className="ml-1 text-xs text-gray-500">
                            ({Math.round((entry.value / total) * 100)}%)
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Orders Trend */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Monthly Orders Trend</CardTitle>
            <CardDescription>Order volume over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Expense Categories */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Top Expense Categories</CardTitle>
            <CardDescription>Highest spending categories</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseTypeData.length === 0 ? (
              <p className="py-24 text-center text-sm text-gray-500">No expenses in this period.</p>
            ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expenseTypeData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => `₹${Number(value).toLocaleString()}`} />
                <Bar dataKey="value" fill="#82ca9d" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">New Customers</CardTitle>
            <Users className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{newCustomers}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">In selected period</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Appointments</CardTitle>
            <Calendar className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{completedAppointments}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Completed appointments</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Order Value</CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ₹{totalOrders > 0 ? Math.round(totalRevenue / totalOrders).toLocaleString() : '0'}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Per order</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Staff Count</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.staff.length}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total staff members</p>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default Reports;
