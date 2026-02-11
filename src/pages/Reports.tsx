
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Users, ShoppingCart, Calendar, Download } from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

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
      
      // Fetch all data collections
      const collections = ['orders', 'customers', 'expenses', 'inventory', 'staff', 'appointments'];
      const results: any = {};

      for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        results[collectionName] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      setData(results);
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

  const totalRevenue = filteredOrders
    .filter(order => order.status === 'delivered')
    .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  const totalExpenses = filteredExpenses
    .reduce((sum, expense) => sum + (expense.amount || 0), 0);

  const netProfit = totalRevenue - totalExpenses;

  const totalOrders = filteredOrders.length;
  const newCustomers = filteredCustomers.length;
  const completedAppointments = filteredAppointments.filter(apt => apt.status === 'completed').length;

  // Chart data
  const monthlyData = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  for (let i = 0; i < 12; i++) {
    const monthOrders = data.orders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      return orderDate.getMonth() === i && orderDate.getFullYear() === new Date().getFullYear();
    });
    
    const monthExpenses = data.expenses.filter(expense => {
      if (!expense.date) return false;
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === i && expenseDate.getFullYear() === new Date().getFullYear();
    });

    monthlyData.push({
      month: months[i],
      revenue: monthOrders
        .filter(order => order.status === 'delivered')
        .reduce((sum, order) => sum + (order.totalAmount || 0), 0),
      expenses: monthExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
      orders: monthOrders.length
    });
  }

  const orderStatusData = [
    { name: 'Received', value: data.orders.filter(o => o.status === 'received').length, color: '#8884d8' },
    { name: 'In Progress', value: data.orders.filter(o => o.status === 'in-progress').length, color: '#82ca9d' },
    { name: 'Ready', value: data.orders.filter(o => o.status === 'ready').length, color: '#ffc658' },
    { name: 'Delivered', value: data.orders.filter(o => o.status === 'delivered').length, color: '#ff7c7c' }
  ];

  const expenseTypeData = data.expenses.reduce((acc: any[], expense) => {
    const existing = acc.find(item => item.name === expense.type);
    if (existing) {
      existing.value += expense.amount || 0;
    } else {
      acc.push({ name: expense.type, value: expense.amount || 0 });
    }
    return acc;
  }, []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Reports & Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">Business insights and performance metrics</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">From delivered orders</p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</CardTitle>
            <TrendingUp className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Business expenses</p>
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
            <p className="text-xs text-gray-500 dark:text-gray-400">Revenue - Expenses</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {orderStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expenseTypeData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Bar dataKey="value" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
  );
};

export default Reports;
