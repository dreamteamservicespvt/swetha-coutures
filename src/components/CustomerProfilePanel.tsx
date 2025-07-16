import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, Phone, Mail, MapPin, Package, Ruler, Calendar, IndianRupee, ShoppingBag, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
  sizes?: Record<string, string>; // Add sizes field
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

interface Bill {
  id: string;
  billId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  orderId?: string;
  items?: Array<{
    id: string;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    type?: string;
  }>;
  products?: Array<{
    name: string;
    descriptions: Array<{
      description: string;
      qty: number;
      rate: number;
      amount: number;
    }>;
  }>;
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  discount: number;
  discountType: 'amount' | 'percentage';
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: 'paid' | 'partial' | 'unpaid';
  date: any;
  dueDate?: any;
  notes?: string;
  createdAt?: any;
}

interface CustomerProfilePanelProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'orders' | 'bills';
}

const CustomerProfilePanel: React.FC<CustomerProfilePanelProps> = ({ customer, isOpen, onClose, initialTab = 'orders' }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [aggregatedSizes, setAggregatedSizes] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'orders' | 'bills'>(initialTab);

  useEffect(() => {
    if (customer && isOpen) {
      fetchCustomerData();
    }
  }, [customer, isOpen]);

  // Reset tab when initialTab changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchCustomerData = async () => {
    if (!customer) return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchCustomerOrders(),
        fetchCustomerBills()
      ]);
    } catch (error) {
      console.error('Error fetching customer data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customer data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerOrders = async () => {
    if (!customer) return;
    
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
    }
  };

  const fetchCustomerBills = async () => {
    if (!customer) return;
    
    console.log('Fetching bills for customer:', customer.name, 'with ID:', customer.id);
    
    try {
      // Try to fetch bills by customerId first
      let billsQuery = query(
        collection(db, 'bills'),
        where('customerId', '==', customer.id)
      );
      let billsSnapshot = await getDocs(billsQuery);
      let billsData = billsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bill[];
      
      console.log('Bills found by customerId:', billsData.length);
      
      // If no bills found by customerId, try by customerName (exact match)
      if (billsData.length === 0) {
        billsQuery = query(
          collection(db, 'bills'),
          where('customerName', '==', customer.name)
        );
        billsSnapshot = await getDocs(billsQuery);
        billsData = billsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Bill[];
        
        console.log('Bills found by exact customerName:', billsData.length);
        
        // If still no bills found, try case-insensitive search by fetching all bills and filtering
        if (billsData.length === 0) {
          billsQuery = query(collection(db, 'bills'));
          billsSnapshot = await getDocs(billsQuery);
          const allBills = billsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Bill[];
          
          billsData = allBills.filter(bill => 
            bill.customerName && 
            bill.customerName.toLowerCase() === customer.name.toLowerCase()
          );
          
          console.log('Bills found by case-insensitive customerName:', billsData.length);
        }
      }
      
      // Sort bills by date (newest first)
      billsData.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log('Final bills found:', billsData.length);
      setBills(billsData);
    } catch (error) {
      console.error('Error fetching customer bills:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customer bills",
        variant: "destructive",
      });
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

          {/* Customer Sizes */}
          {customer.sizes && Object.keys(customer.sizes).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ruler className="h-5 w-5" />
                  Size Measurements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(customer.sizes).map(([sizeKey, sizeValue]) => (
                    <div key={sizeKey} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="font-medium text-sm">{sizeKey}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{sizeValue}"</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Orders and Bills Tabs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Transaction History
              </CardTitle>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'orders'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Orders ({orders.length})
                </button>
                <button
                  onClick={() => setActiveTab('bills')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'bills'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Bills ({bills.length})
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading {activeTab}...</div>
              ) : (
                <>
                  {activeTab === 'orders' && (
                    orders.length > 0 ? (
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
                    )
                  )}
                  
                  {activeTab === 'bills' && (
                    bills.length > 0 ? (
                      <div className="space-y-4">
                        {bills.map((bill) => (
                          <div key={bill.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                            {/* Bill Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-5 w-5 text-blue-600" />
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    Bill #{bill.billId}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {bill.status === 'paid' && (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  )}
                                  {bill.status === 'partial' && (
                                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                                  )}
                                  {bill.status === 'unpaid' && (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className={`text-sm px-2 py-1 rounded ${
                                    bill.status === 'paid' ? 'bg-green-100 text-green-800' :
                                    bill.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {bill.status}
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm text-gray-500">
                                {new Date(bill.date?.toDate ? bill.date.toDate() : bill.date).toLocaleDateString()}
                              </div>
                            </div>
                            
                            {/* Bill Details */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Total Amount:</span>
                                <span className="font-medium flex items-center gap-1">
                                  <IndianRupee className="h-4 w-4" />
                                  {bill.totalAmount.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Paid Amount:</span>
                                <span className="font-medium flex items-center gap-1">
                                  <IndianRupee className="h-4 w-4" />
                                  {bill.paidAmount.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Balance:</span>
                                <span className="font-medium flex items-center gap-1">
                                  <IndianRupee className="h-4 w-4" />
                                  {bill.balance.toLocaleString()}
                                </span>
                              </div>
                              
                              {bill.notes && (
                                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                                  <strong>Notes:</strong> {bill.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p>No bills found for this customer</p>
                      </div>
                    )
                  )}
                </>
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

