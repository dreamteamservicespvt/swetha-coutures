import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Calendar,
  Package,
  User,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface StaffOrder {
  id: string;
  customerName: string; // Only customer name, no phone/email
  items: {
    description: string;
    category: string;
    quantity: number;
    status: string;
    deliveryDate: string;
    orderDate: string;
    notes?: string;
  }[];
  status: 'pending' | 'in-progress' | 'completed' | 'delivered';
  assignedStaff: string[];
  createdAt: any;
}

const StaffOrdersView = () => {
  const { userData } = useAuth();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (userData) {
      fetchAssignedOrders();
    }
  }, [userData]);

  const fetchAssignedOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch only orders assigned to this staff member
      const ordersQuery = query(
        collection(db, 'orders'),
        where('assignedStaff', 'array-contains', userData?.uid),
        orderBy('createdAt', 'desc')
      );
      
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          customerName: data.customerName, // Only name, no contact details
          items: data.items || [],
          status: data.status,
          assignedStaff: data.assignedStaff || [],
          createdAt: data.createdAt
        };
      }) as StaffOrder[];

      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching assigned orders:', error);
      toast({
        title: "Error",
        description: "Failed to load assigned orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        lastUpdated: new Date()
      });
      
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
      
      fetchAssignedOrders(); // Refresh the data
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700';
      case 'delivered':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'in-progress':
        return <Clock className="h-4 w-4" />;
      case 'delivered':
        return <Package className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.items.some(item => 
                           item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.category.toLowerCase().includes(searchTerm.toLowerCase())
                         );
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">My Assigned Orders</h1>
        <p className="text-white/90">
          Orders that have been assigned to you for completion
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Orders</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by customer name or item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <div>
                      <CardTitle className="text-lg">Customer: {order.customerName}</CardTitle>
                      <CardDescription>
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1 capitalize">{order.status}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Item Description</label>
                          <p className="font-medium">{item.description}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Category</label>
                          <p>{item.category}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Quantity</label>
                          <p>{item.quantity}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Order Date</label>
                          <p>{item.orderDate ? new Date(item.orderDate).toLocaleDateString() : 'Not set'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Delivery Date</label>
                          <p className={
                            item.deliveryDate && new Date(item.deliveryDate) < new Date() 
                              ? 'text-red-600 font-medium' 
                              : ''
                          }>
                            {item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : 'Not set'}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Item Status</label>
                          <Badge className={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                      {item.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Notes</label>
                          <p className="text-sm text-gray-700 mt-1">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Status Update Section */}
                  <div className="pt-4 border-t">
                    <label className="text-sm font-medium text-gray-600 mb-2 block">
                      Update Order Status
                    </label>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant={order.status === 'in-progress' ? 'default' : 'outline'}
                        onClick={() => updateOrderStatus(order.id, 'in-progress')}
                        disabled={order.status === 'in-progress'}
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        In Progress
                      </Button>
                      <Button
                        size="sm"
                        variant={order.status === 'completed' ? 'default' : 'outline'}
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        disabled={order.status === 'completed' || order.status === 'delivered'}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Completed
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Note: You can only update to "In Progress" or "Completed". Admin will handle delivery status.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Assigned Orders</h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No orders match your current filters.' 
                  : 'You have no orders assigned to you at the moment.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StaffOrdersView;
