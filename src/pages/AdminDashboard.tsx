import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRealTimeStats } from '@/hooks/useRealTimeData';
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  Plus, 
  Package, 
  Calendar, 
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Truck,
  UserCheck,
  BarChart3,
  Eye,
  ArrowUpRight,
  Building2,
  PieChart,
  Calculator
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import AttendanceManagement from '@/components/AttendanceManagement';
import RoleAnalytics from '@/components/RoleAnalytics';
import ROIDashboard from '@/components/ROIDashboard';
import IncomeExpensesCard from '@/components/admin/IncomeExpensesCard';

interface Bill {
  id: string;
  balance?: number;
  totalAmount?: number;
  [key: string]: any;
}

interface ExtendedStats {
  totalOrders: number;
  totalRevenue: number;
  readyOrders: number;
  totalCustomers: number;
  todaysAppointments: number;
  employeesPresentToday: number;
  employeeROI: number;
  inventoryROI: number;
  activeOrders: number;
  pendingOrders: number;
  completedOrders: number;
  lowStockItems: number;
  dueBills: number;
  dueBillsAmount: number;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive';
  salaryAmount?: number;
  // New salary fields
  paidSalary?: number;
  bonus?: number;
}

interface AttendanceRecord {
  id: string;
  staffId: string;
  date: string;
  checkIn?: string;
  status: 'pending' | 'confirmed' | 'rejected';
}

const AdminDashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const { stats, loading, error, rawData } = useRealTimeStats();
  const [extendedStats, setExtendedStats] = useState<ExtendedStats>({
    totalOrders: 0,
    totalRevenue: 0,
    readyOrders: 0,
    totalCustomers: 0,
    todaysAppointments: 0,
    employeesPresentToday: 0,
    employeeROI: 0,
    inventoryROI: 0,
    activeOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    lowStockItems: 0,
    dueBills: 0,
    dueBillsAmount: 0,
  });
  const [staffData, setStaffData] = useState<StaffMember[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);

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

  // Redirect staff to staff dashboard
  useEffect(() => {
    if (userData?.role === 'staff') {
      navigate('/staff/dashboard');
    }
  }, [userData, navigate]);

  // Fetch extended data for admin metrics
  useEffect(() => {
    if (userData?.role === 'admin') {
      fetchExtendedStats();
      setupRealTimeListeners();
    }
  }, [userData, rawData]);

  const fetchExtendedStats = async () => {
    try {
      // Fetch staff data
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const staff = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StaffMember[];
      setStaffData(staff);

      // Fetch today's attendance
      const today = new Date().toISOString().split('T')[0];
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('date', '==', today)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendance = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceRecord[];
      setAttendanceData(attendance);

      // Fetch bills with outstanding balance
      const billsSnapshot = await getDocs(collection(db, 'bills'));
      const dueBillsList = billsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Bill))
        .filter(bill => (bill.balance || 0) > 0);
      
      const dueBillsCount = dueBillsList.length;
      const dueBillsTotal = dueBillsList.reduce((sum, bill) => sum + (bill.balance || 0), 0);

      // Calculate extended stats
      const readyOrders = rawData.orders?.filter(order => order.status === 'ready').length || 0;
      const employeesPresentToday = attendance.filter(record => 
        record.checkIn && record.status === 'confirmed'
      ).length;

      // Calculate Employee ROI
      const totalSalaries = staff.reduce((sum, member) => sum + calculateMonthlySalary(member), 0);
      const totalRevenue = rawData.orders?.reduce((sum, order) => {
        return order.status === 'delivered' ? sum + (order.totalAmount || 0) : sum;
      }, 0) || 0;
      const employeeROI = totalSalaries > 0 ? ((totalRevenue - totalSalaries) / totalSalaries) * 100 : 0;

      // Calculate Inventory ROI (simplified)
      const totalInventoryValue = rawData.inventory?.reduce((sum, item) => {
        return sum + ((item.quantity || 0) * (item.pricePerUnit || 0));
      }, 0) || 0;
      const inventoryROI = totalInventoryValue > 0 ? ((totalRevenue * 0.6) / totalInventoryValue) * 100 : 0;

      setExtendedStats({
        totalOrders: stats.totalOrders,
        totalRevenue: stats.totalRevenue,
        readyOrders,
        totalCustomers: stats.totalCustomers,
        todaysAppointments: stats.todaysAppointments,
        employeesPresentToday,
        employeeROI,
        inventoryROI,
        activeOrders: stats.activeOrders,
        pendingOrders: stats.pendingOrders,
        completedOrders: stats.completedOrders,
        lowStockItems: stats.lowStockItems,
        dueBills: dueBillsCount,
        dueBillsAmount: dueBillsTotal
      });

    } catch (error) {
      console.error('Error fetching extended stats:', error);
    }
  };

  const setupRealTimeListeners = () => {
    // Real-time attendance listener
    const today = new Date().toISOString().split('T')[0];
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('date', '==', today)
    );

    const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
      const attendance = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceRecord[];
      setAttendanceData(attendance);
      
      const employeesPresentToday = attendance.filter(record => 
        record.checkIn && record.status === 'confirmed'
      ).length;

      setExtendedStats(prev => ({
        ...prev,
        employeesPresentToday
      }));
    });

    return () => unsubscribe();
  };

  const handleCardClick = (cardType: string) => {
    switch (cardType) {
      case 'totalOrders':
        navigate('/orders');
        break;
      case 'totalRevenue':
        navigate('/billing');
        break;
      case 'readyOrders':
        navigate('/orders', { state: { filterStatus: 'ready' } });
        break;
      case 'totalCustomers':
        navigate('/customers');
        break;
      case 'todaysAppointments':
        navigate('/appointments');
        break;
      case 'dueBills':
        navigate('/billing', { state: { filterStatus: 'unpaid' } });
        break;
      case 'employeesPresent':
        navigate('/staff');
        break;
      case 'inventory':
        navigate('/inventory');
        break;
      default:
        break;
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'new-order':
        navigate('/orders');
        break;
      case 'add-inventory':
        navigate('/inventory');
        break;
      case 'book-appointment':
        navigate('/appointments');
        break;
      case 'staff-management':
        navigate('/staff');
        break;
      default:
        break;
    }
  };

  // Access control
  if (!userData) {
    return <LoadingSpinner type="page" />;
  }

  if (userData.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600 text-center">
              You don't have permission to access the admin dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner type="page" />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="text-red-600 mb-4">Error loading dashboard data</div>
            <p className="text-gray-600 text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryStatCards = [
    {
      title: 'Total Orders',
      value: extendedStats.totalOrders,
      icon: ShoppingCart,
      description: 'All time orders',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      cardType: 'totalOrders',
      trend: '+12%'
    },
    {
      title: 'Total Revenue',
      value: `₹${extendedStats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      description: 'From delivered orders',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      cardType: 'totalRevenue',
      trend: '+8.5%'
    },
    {
      title: 'Ready for Delivery',
      value: extendedStats.readyOrders,
      icon: Truck,
      description: 'Orders ready to ship',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      cardType: 'readyOrders',
      trend: '+3'
    },
    {
      title: 'Total Customers',
      value: extendedStats.totalCustomers,
      icon: Users,
      description: 'Registered customers',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      cardType: 'totalCustomers',
      trend: '+5.2%'
    }
  ];

  const secondaryStatCards = [
    {
      title: "Today's Appointments",
      value: extendedStats.todaysAppointments,
      icon: Calendar,
      description: 'Scheduled for today',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      cardType: 'todaysAppointments'
    },
    {
      title: "Due Bills",
      value: extendedStats.dueBills,
      icon: DollarSign,
      description: `Total ₹${extendedStats.dueBillsAmount.toLocaleString()}`,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      cardType: 'dueBills'
    },
    // Custom component will be used instead of these three cards
    // {
    //   title: 'Employees Present',
    //   value: extendedStats.employeesPresentToday,
    //   icon: UserCheck,
    //   description: 'Checked in today',
    //   color: 'text-teal-600',
    //   bgColor: 'bg-teal-50',
    //   cardType: 'employeesPresent'
    // },
    // {
    //   title: 'Employee ROI',
    //   value: `${extendedStats.employeeROI.toFixed(1)}%`,
    //   icon: TrendingUp,
    //   description: 'Return on investment',
    //   color: extendedStats.employeeROI >= 0 ? 'text-green-600' : 'text-red-600',
    //   bgColor: extendedStats.employeeROI >= 0 ? 'bg-green-50' : 'bg-red-50',
    //   cardType: 'employeeROI'
    // },
    // {
    //   title: 'Inventory ROI',
    //   value: `${extendedStats.inventoryROI.toFixed(1)}%`,
    //   icon: Package,
    //   description: 'Inventory efficiency',
    //   color: extendedStats.inventoryROI >= 0 ? 'text-green-600' : 'text-red-600',
    //   bgColor: extendedStats.inventoryROI >= 0 ? 'bg-green-50' : 'bg-red-50',
    //   cardType: 'inventory'
    // }
  ];

  return (
    <div className="space-y-6">
      {/* Enhanced Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 bg-white opacity-10 rounded-full"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-16 w-16 bg-white opacity-10 rounded-full"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {userData?.name}!
          </h1>
          <p className="text-white/90 text-lg">
            Here's your business overview and key metrics at a glance.
          </p>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {primaryStatCards.map((stat, index) => (
          <Card 
            key={index} 
            className="hover:shadow-xl transition-all duration-300 border-0 shadow-lg cursor-pointer group transform hover:-translate-y-1"
            onClick={() => handleCardClick(stat.cardType)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.title}
              </CardTitle>
              <div className={`p-3 rounded-lg ${stat.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{stat.description}</p>
                </div>
                <div className="flex items-center space-x-1">
                  <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:text-gray-400" />
                  {stat.trend && (
                    <span className="text-xs text-green-600 font-medium">{stat.trend}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* First card is Today's Appointments */}
        {secondaryStatCards.map((stat, index) => (
          <Card 
            key={index} 
            className="hover:shadow-lg transition-all duration-300 border-0 shadow-md cursor-pointer group"
            onClick={() => handleCardClick(stat.cardType)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-gray-900 mb-1">
                {stat.value}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
        
        {/* Income & Expenses Card (replaces 2 cards) */}
        <div className="md:col-span-2">
          <IncomeExpensesCard onClick={() => navigate('/income-expenses')} />
        </div>
      </div>

      {/* Quick Actions Panel */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <span>Quick Actions</span>
          </CardTitle>
          <CardDescription>Frequently used administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              className="p-6 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:shadow-lg transition-all duration-300 h-auto flex-col space-y-2"
              onClick={() => handleQuickAction('new-order')}
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">New Order</span>
            </Button>
            <Button 
              className="p-6 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl hover:shadow-lg transition-all duration-300 h-auto flex-col space-y-2"
              onClick={() => handleQuickAction('book-appointment')}
            >
              <Calendar className="h-6 w-6" />
              <span className="text-sm font-medium">Book Appointment</span>
            </Button>
            <Button 
              className="p-6 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:shadow-lg transition-all duration-300 h-auto flex-col space-y-2"
              onClick={() => handleQuickAction('add-inventory')}
            >
              <Package className="h-6 w-6" />
              <span className="text-sm font-medium">Add Inventory</span>
            </Button>
            <Button 
              className="p-6 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:shadow-lg transition-all duration-300 h-auto flex-col space-y-2"
              onClick={() => handleQuickAction('staff-management')}
            >
              <UserPlus className="h-6 w-6" />
              <span className="text-sm font-medium">Staff Management</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Tabs for different sections */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 p-1 bg-gray-100 rounded-lg">
          <TabsTrigger value="overview" className="rounded-md">Overview</TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-md">Attendance</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-md">Analytics</TabsTrigger>
          <TabsTrigger value="roi" className="rounded-md">ROI Dashboard</TabsTrigger>
          <TabsTrigger value="insights" className="rounded-md">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Order Status Distribution */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <span>Order Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Pending:</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                        {extendedStats.pendingOrders}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Active:</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {extendedStats.activeOrders}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Completed:</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {extendedStats.completedOrders}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Staff Status */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  <span>Staff Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Staff:</span>
                    <span className="font-medium text-lg">{staffData.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Present Today:</span>
                    <Badge className="bg-green-100 text-green-700">
                      {extendedStats.employeesPresentToday}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Active Staff:</span>
                    <span className="font-medium">
                      {staffData.filter(s => s.status === 'active').length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Alert */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-orange-600" />
                  <span>Inventory Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Low Stock Items:</span>
                    <Badge variant={extendedStats.lowStockItems > 0 ? "destructive" : "outline"}>
                      {extendedStats.lowStockItems}
                    </Badge>
                  </div>
                  {extendedStats.lowStockItems > 0 && (
                    <p className="text-xs text-red-600">
                      Items requiring immediate reorder
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceManagement />
        </TabsContent>

        <TabsContent value="analytics">
          <RoleAnalytics />
        </TabsContent>

        <TabsContent value="roi">
          <ROIDashboard />
        </TabsContent>

        <TabsContent value="insights">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="h-5 w-5 text-indigo-600" />
                <span>Business Insights</span>
              </CardTitle>
              <CardDescription>
                Key performance indicators and business intelligence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">Performance Metrics</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Order Completion Rate:</span>
                      <span className="font-semibold text-green-600">
                        {extendedStats.totalOrders > 0 
                          ? Math.round((extendedStats.completedOrders / extendedStats.totalOrders) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Average Order Value:</span>
                      <span className="font-semibold">
                        ₹{extendedStats.totalOrders > 0 
                          ? Math.round(extendedStats.totalRevenue / extendedStats.totalOrders).toLocaleString()
                          : 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Staff Attendance Rate:</span>
                      <span className="font-semibold text-blue-600">
                        {staffData.length > 0 
                          ? Math.round((extendedStats.employeesPresentToday / staffData.length) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">ROI Analysis</h4>
                  <div className="space-y-3">
                    <div className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Employee ROI</span>
                        <span className={`font-bold ${extendedStats.employeeROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {extendedStats.employeeROI.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Return on staff investment
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Inventory ROI</span>
                        <span className={`font-bold ${extendedStats.inventoryROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {extendedStats.inventoryROI.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Inventory turnover efficiency
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
