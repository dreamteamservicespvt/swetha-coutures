
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react';

interface AnalyticsData {
  role: string;
  revenue: number;
  salary: number;
  profit: number;
  staffCount: number;
  ordersCount: number;
}

const RoleAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      // Fetch all staff members
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const staff = staffSnapshot.docs.map(doc => doc.data());

      // Fetch all orders
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const orders = ordersSnapshot.docs.map(doc => doc.data());

      // Group data by role
      const roleMap = new Map<string, AnalyticsData>();

      // Initialize roles
      staff.forEach(member => {
        const role = member.role || 'Unknown';
        if (!roleMap.has(role)) {
          roleMap.set(role, {
            role,
            revenue: 0,
            salary: 0,
            profit: 0,
            staffCount: 0,
            ordersCount: 0
          });
        }
        
        const roleData = roleMap.get(role)!;
        roleData.staffCount += 1;
        roleData.salary += (member.salaryAmount || 0);
      });

      // Calculate revenue from orders
      orders.forEach(order => {
        if (order.assignedRoles && Array.isArray(order.assignedRoles)) {
          const orderValue = (order.totalAmount || 0) / order.assignedRoles.length;
          
          order.assignedRoles.forEach((role: string) => {
            if (roleMap.has(role)) {
              const roleData = roleMap.get(role)!;
              roleData.revenue += orderValue;
              roleData.ordersCount += 1;
            }
          });
        }
      });

      // Calculate profit
      roleMap.forEach((data, role) => {
        data.profit = data.revenue - data.salary;
      });

      setAnalyticsData(Array.from(roleMap.values()));
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">Loading analytics...</div>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = analyticsData.reduce((sum, role) => sum + role.revenue, 0);
  const totalSalary = analyticsData.reduce((sum, role) => sum + role.salary, 0);
  const totalProfit = totalRevenue - totalSalary;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Salary</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalSalary.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            {totalProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{totalProfit.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Role Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue & Profit by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="role" />
                <YAxis />
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                <Bar dataKey="profit" fill="#82ca9d" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Staff Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Distribution by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ role, staffCount }) => `${role}: ${staffCount}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="staffCount"
                >
                  {analyticsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Role Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Role Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Role</th>
                  <th className="text-right p-2">Staff Count</th>
                  <th className="text-right p-2">Orders</th>
                  <th className="text-right p-2">Revenue</th>
                  <th className="text-right p-2">Salary</th>
                  <th className="text-right p-2">Profit</th>
                  <th className="text-right p-2">ROI</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.map((role, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2 font-medium">{role.role}</td>
                    <td className="p-2 text-right">{role.staffCount}</td>
                    <td className="p-2 text-right">{role.ordersCount}</td>
                    <td className="p-2 text-right">₹{role.revenue.toLocaleString()}</td>
                    <td className="p-2 text-right">₹{role.salary.toLocaleString()}</td>
                    <td className={`p-2 text-right ${role.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{role.profit.toLocaleString()}
                    </td>
                    <td className={`p-2 text-right ${role.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {role.salary > 0 ? ((role.profit / role.salary) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleAnalytics;
