
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  Package, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  Plus,
  UserPlus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRealTimeStats } from '@/hooks/useRealTimeData';
import ContactActions from '@/components/ContactActions';
import { getOrderStatusMessage } from '@/utils/contactUtils';

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderItems: Array<{
    itemName: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status: 'received' | 'in-progress' | 'ready' | 'delivered';
  deliveryDate: string;
  notes?: string;
  createdAt: any;
  measurements?: {
    chest?: string;
    waist?: string;
    length?: string;
    shoulder?: string;
  };
}

interface Alert {
  id: string;
  type: 'overdue' | 'low-stock' | 'payment';
  title: string;
  description: string;
  count?: number;
  amount?: number;
  severity: 'high' | 'medium' | 'low';
}

const Dashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const { stats, loading, error } = useRealTimeStats();
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Redirect staff to staff dashboard
  useEffect(() => {
    if (userData?.role === 'staff') {
      navigate('/staff/dashboard');
    }
  }, [userData, navigate]);

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
      case 'staff-checkin':
        navigate('/staff');
        break;
      default:
        break;
    }
  };

  const statCards = [
    {
      title: 'Total Revenue',
      value: `₹${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      description: 'From delivered orders',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: ShoppingCart,
      description: 'All time orders',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Active Orders',
      value: stats.activeOrders,
      icon: Clock,
      description: 'In progress orders',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Pending Orders',
      value: stats.pendingOrders,
      icon: XCircle,
      description: 'Waiting to start',
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Completed Orders',
      value: stats.completedOrders,
      icon: CheckCircle,
      description: 'Ready & delivered',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Total Customers',
      value: stats.totalCustomers,
      icon: Users,
      description: 'Registered customers',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {userData?.name}!
        </h1>
        <p className="text-white/90">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-all duration-300 border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {stat.value}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span>System Alerts</span>
            </CardTitle>
            <CardDescription>Important notifications and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'high' ? 'bg-red-50 border-red-400' :
                  alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-blue-50 border-blue-400'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{alert.title}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{alert.description}</div>
                    </div>
                    <Badge variant={
                      alert.severity === 'high' ? 'destructive' :
                      alert.severity === 'medium' ? 'secondary' : 'outline'
                    }>
                      {alert.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
              <span>Recent Orders</span>
            </CardTitle>
            <CardDescription>Latest order activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {order.customerName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Order #{order.id.slice(-6)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          ₹{order.totalAmount?.toLocaleString()}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          order.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'in-progress' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700 dark:text-gray-300'
                        }`}>
                          {order.status?.replace('-', ' ')}
                        </div>
                      </div>
                      <ContactActions 
                        phone={order.customerPhone}
                        message={getOrderStatusMessage(order.customerName, order.id, order.status)}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No recent orders found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Quick Actions */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span>Quick Actions</span>
            </CardTitle>
            <CardDescription>Frequently used tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                className="p-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all duration-300 h-auto flex-col"
                onClick={() => handleQuickAction('new-order')}
              >
                <Plus className="h-6 w-6 mb-2" />
                <div className="text-sm font-medium">New Order</div>
              </Button>
              <Button 
                className="p-4 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:shadow-lg transition-all duration-300 h-auto flex-col"
                onClick={() => handleQuickAction('book-appointment')}
              >
                <Calendar className="h-6 w-6 mb-2" />
                <div className="text-sm font-medium">Book Appointment</div>
              </Button>
              <Button 
                className="p-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg transition-all duration-300 h-auto flex-col"
                onClick={() => handleQuickAction('add-inventory')}
              >
                <Package className="h-6 w-6 mb-2" />
                <div className="text-sm font-medium">Add Inventory</div>
              </Button>
              <Button 
                className="p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all duration-300 h-auto flex-col"
                onClick={() => handleQuickAction('staff-checkin')}
              >
                <UserPlus className="h-6 w-6 mb-2" />
                <div className="text-sm font-medium">Staff Check-in</div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
