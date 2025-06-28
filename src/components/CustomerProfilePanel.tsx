
import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, Phone, Mail, MapPin, Package, Ruler } from 'lucide-react';
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
  customerId: string;
  items: Array<{
    itemType: string;
    quantity: number;
    sizes?: Record<string, any>;
  }>;
  totalAmount: number;
  status: string;
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
    try {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('customerId', '==', customer.id)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
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
      <SheetContent className="w-[80%] sm:w-[40%] overflow-y-auto">
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
                Orders ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading orders...</div>
              ) : orders.length > 0 ? (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">Order #{order.id.slice(-6)}</span>
                        <Badge variant="outline">{order.status}</Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>Items: {order.items?.length || 0}</div>
                        <div>Total: ₹{(order.totalAmount || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">No orders found</div>
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
