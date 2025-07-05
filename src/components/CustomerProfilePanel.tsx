import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, Phone, Mail, MapPin, Package, Ruler, Calendar, IndianRupee, ShoppingBag } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  pincode?: string;
  customerType: 'regular' | 'premium' | 'vip';
}

interface Order {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: Array<{
    madeFor: string;
    category: string;
    description: string;
    quantity: number;
    status: string;
    orderDate: string;
    deliveryDate: string;
    assignedStaff: string[];
    requiredMaterials: any[];
    designImages: string[];
    notes: string;
    sizes?: Record<string, any>;
    rate?: number;
    amount?: number;
  }>;
  itemType: string;
  quantity: number;
  status: string;
  orderDate: string;
  deliveryDate: any;
  notes?: string;
  assignedStaff?: string[];
  requiredMaterials?: any[];
  designImages?: string[];
  totalAmount?: number;
  remainingAmount?: number;
  createdAt: any;
}

interface CustomerProfilePanelProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

const CustomerProfilePanel: React.FC<CustomerProfilePanelProps> = ({ customer, isOpen, onClose }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [aggregatedSizes, setAggregatedSizes] = useState<Record<string, any>>({});

  useEffect(() => {
    if (customer && isOpen) {
      fetchCustomerOrders();
    }
  }, [customer, isOpen]);

  const fetchCustomerOrders = async () => {
    if (!customer) return;
    
    setLoading(true);
    console.log('Fetching orders for customer:', customer.name, 'with ID:', customer.id);
    
    try {
      // Try to fetch orders by customerId first
      let ordersQuery = query(
        collection(db, 'orders'),
        where('customerId', '==', customer.id)
      );
      let ordersSnapshot = await getDocs(ordersQuery);
      let ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      console.log('Orders found by customerId:', ordersData.length);
      
      // If no orders found by customerId, try by customerName (exact match)
      if (ordersData.length === 0) {
        ordersQuery = query(
          collection(db, 'orders'),
          where('customerName', '==', customer.name)
        );
        ordersSnapshot = await getDocs(ordersQuery);
        ordersData = ordersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Order[];
        
        console.log('Orders found by exact customerName:', ordersData.length);
        
        // If still no orders found, try case-insensitive search by fetching all orders and filtering
        if (ordersData.length === 0) {
          ordersQuery = query(collection(db, 'orders'));
          ordersSnapshot = await getDocs(ordersQuery);
          const allOrders = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Order[];
          
          ordersData = allOrders.filter(order => 
            order.customerName && 
            order.customerName.toLowerCase() === customer.name.toLowerCase()
          );
          
          console.log('Orders found by case-insensitive customerName:', ordersData.length);
        }
      }
      
      // Sort orders by creation date (newest first)
      ordersData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log('Final orders found:', ordersData.length);
      setOrders(ordersData);
      aggregateSizes(ordersData);
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customer orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const aggregateSizes = (orders: Order[]) => {
    const sizes: Record<string, any> = {};
    
    orders.forEach(order => {
      order.items?.forEach(item => {
        if (item.sizes) {
          Object.entries(item.sizes).forEach(([key, value]) => {
            if (!sizes[key]) {
              sizes[key] = value;
            }
          });
        }
      });
    });
    
    setAggregatedSizes(sizes);
  };

  const getCustomerTypeColor = (type: string) => {
    switch (type) {
      case 'regular': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'premium': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'vip': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (!customer) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[98%] sm:w-[95%] md:w-[90%] lg:w-[85%] xl:w-[80%] max-w-7xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Profile
          </SheetTitle>
          <SheetDescription>
            View detailed information about {customer.name}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Customer Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{customer.name}</span>
                <Badge className={getCustomerTypeColor(customer.customerType)} variant="outline">
                  {customer.customerType}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4" />
                <span>{customer.phone}</span>
              </div>
              
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{customer.email}</span>
                </div>
              )}
              
              {customer.address && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <div>
                    <div>{customer.address}</div>
                    {customer.city && <div>{customer.city} {customer.pincode}</div>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order History ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading orders...</div>
              ) : orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                      {/* Order Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">
                            Order #{order.orderNumber || order.orderId || order.id.slice(-6)}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {order.itemType || 'Order'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {order.status}
                        </Badge>
                      </div>

                      {/* Order Details */}
                      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>
                            Created: {order.createdAt?.toDate ? 
                              order.createdAt.toDate().toLocaleDateString() : 
                              order.orderDate || 'Date not available'
                            }
                          </span>
                        </div>
                        {order.deliveryDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-green-600" />
                            <span>
                              Delivery: {order.deliveryDate?.toDate ? 
                                order.deliveryDate.toDate().toLocaleDateString() : 
                                order.deliveryDate
                              }
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Order Items */}
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4" />
                          Items ({order.items?.length || 0})
                        </h5>
                        {order.items?.map((item, index) => (
                          <div key={index} className="bg-white dark:bg-gray-700 rounded p-3 border">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <p className="font-medium text-base">
                                  {item.description || item.category || 'Item'}
                                </p>
                                {item.madeFor && item.madeFor !== order.customerName && (
                                  <p className="text-sm text-purple-600 dark:text-purple-400">
                                    Made for: {item.madeFor}
                                  </p>
                                )}
                                <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  <span>Qty: {item.quantity || 1}</span>
                                  {item.rate && (
                                    <span>Rate: ₹{(item.rate || 0).toLocaleString()}</span>
                                  )}
                                  <span>Status: {item.status}</span>
                                </div>
                              </div>
                              {item.amount && (
                                <div className="text-right">
                                  <p className="font-bold text-green-600">₹{(item.amount || 0).toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                            
                            {/* Size breakdown */}
                            {item.sizes && Object.keys(item.sizes).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <div className="flex items-center gap-2 mb-2">
                                  <Ruler className="h-4 w-4 text-blue-600" />
                                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Size Measurements:
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                                  {Object.entries(item.sizes).map(([key, value]) => (
                                    <div key={key} className="flex justify-between bg-gray-50 dark:bg-gray-600 rounded px-2 py-1">
                                      <span className="capitalize text-gray-600 dark:text-gray-400">{key}:</span>
                                      <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Order Total */}
                      {order.totalAmount && (
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <span className="font-medium">Order Total:</span>
                          <span className="font-bold text-lg flex items-center gap-1">
                            <IndianRupee className="h-4 w-4" />
                            {(order.totalAmount || 0).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No orders found for this customer</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aggregated Sizes */}
          {Object.keys(aggregatedSizes).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ruler className="h-5 w-5" />
                  Customer Measurements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(aggregatedSizes).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key}:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CustomerProfilePanel;

