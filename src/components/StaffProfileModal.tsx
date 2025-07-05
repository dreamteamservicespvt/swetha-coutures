import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Briefcase, 
  Users, 
  CreditCard,
  MapPin,
  DollarSign,
  Clock,
  Receipt,
  Package,
  CheckCircle,
  AlertCircle,
  Eye
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import LoadingSpinner from '@/components/LoadingSpinner';
import ContactActions from '@/components/ContactActions';

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  department: string;
  skills: string[];
  status: 'active' | 'inactive';
  joinDate: any;
  salary?: number;
  address?: string;
  upiId?: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  salaryAmount?: number;
  salaryMode?: 'monthly' | 'hourly' | 'daily';
  emergencyContact?: {
    name: string;
    phone: string;
    relation: string;
  };
  createdAt: any;
}

interface Order {
  id: string;
  customerName: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  totalAmount: number;
  items: any[];
  assignedStaff?: string[];
}

interface StaffProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
}

const StaffProfileModal: React.FC<StaffProfileModalProps> = ({ isOpen, onClose, staff }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  useEffect(() => {
    if (isOpen && staff) {
      fetchStaffOrders();
    }
  }, [isOpen, staff]);

  const fetchStaffOrders = async () => {
    if (!staff) return;
    
    try {
      setLoading(true);
      const ordersQuery = query(
        collection(db, 'orders'),
        where('assignedStaff', 'array-contains', staff.id),
        orderBy('createdAt', 'desc')
      );
      
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching staff orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'default';
      case 'in-progress':
      case 'confirmed':
        return 'secondary';
      case 'pending':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (!staff) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-bold">
                  {getInitials(staff.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xl font-bold">{staff.name}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Badge variant={staff.status === 'active' ? 'default' : 'secondary'}>
                    {staff.status}
                  </Badge>
                  <span>{staff.role}</span>
                  <span>•</span>
                  <span>{staff.department}</span>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="orders">
                Orders ({orders.length})
              </TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{staff.phone}</span>
                      <ContactActions phone={staff.phone} message={`Hi ${staff.name}, this is regarding work updates.`} />
                    </div>
                    {staff.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{staff.email}</span>
                      </div>
                    )}
                    {staff.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{staff.address}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Work Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Work Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{staff.department}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Joined: {staff.joinDate ? format(staff.joinDate.toDate(), 'PPP') : 'N/A'}</span>
                    </div>
                    {staff.skills && staff.skills.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Skills:</p>
                        <div className="flex flex-wrap gap-1">
                          {staff.skills.map((skill, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment Information */}
                {(staff.salaryAmount || staff.upiId || staff.bankName) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Payment Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {staff.salaryAmount && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>₹{staff.salaryAmount.toLocaleString()} / {staff.salaryMode}</span>
                        </div>
                      )}
                      {staff.upiId && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">UPI ID: {staff.upiId}</span>
                        </div>
                      )}
                      {staff.bankName && (
                        <div className="text-sm space-y-1">
                          <div>Bank: {staff.bankName}</div>
                          {staff.accountNo && <div>Account: ****{staff.accountNo.slice(-4)}</div>}
                          {staff.ifsc && <div>IFSC: {staff.ifsc}</div>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Emergency Contact */}
                {staff.emergencyContact && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Emergency Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>{staff.emergencyContact.name}</div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{staff.emergencyContact.phone}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Relation: {staff.emergencyContact.relation}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : orders.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {orders.map((order) => (
                      <Card key={order.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{order.customerName}</CardTitle>
                              <p className="text-sm text-muted-foreground">Order #{order.id.slice(-6)}</p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(order.status)}>
                              {order.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Order Date:</span>
                              <span>{order.orderDate}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Delivery:</span>
                              <span>{order.deliveryDate}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Amount:</span>
                              <span className="font-medium">₹{order.totalAmount?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Items:</span>
                              <span>{order.items?.length || 0} items</span>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderDetails(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Orders Assigned</h3>
                  <p className="text-muted-foreground">
                    This staff member hasn't been assigned to any orders yet.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{orders.length}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Completed Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {orders.filter(o => ['completed', 'delivered'].includes(o.status?.toLowerCase())).length}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {orders.filter(o => ['in-progress', 'confirmed'].includes(o.status?.toLowerCase())).length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div>
                        <p className="font-medium">{order.customerName}</p>
                        <p className="text-sm text-muted-foreground">{order.orderDate}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={getStatusBadgeVariant(order.status)} className="mb-1">
                          {order.status}
                        </Badge>
                        <p className="text-sm font-medium">₹{order.totalAmount?.toLocaleString() || 0}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Order Details Modal */}
      {selectedOrder && (
        <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Order Details - {selectedOrder.customerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Order ID:</span> #{selectedOrder.id.slice(-8)}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  <Badge variant={getStatusBadgeVariant(selectedOrder.status)}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Order Date:</span> {selectedOrder.orderDate}
                </div>
                <div>
                  <span className="font-medium">Delivery Date:</span> {selectedOrder.deliveryDate}
                </div>
                <div>
                  <span className="font-medium">Total Amount:</span> ₹{selectedOrder.totalAmount?.toLocaleString() || 0}
                </div>
                <div>
                  <span className="font-medium">Items:</span> {selectedOrder.items?.length || 0} items
                </div>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Order Items:</h4>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <p className="font-medium">{item.type || 'Item'}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">₹{item.price?.toLocaleString() || 0}</p>
                          {item.quantity && <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default StaffProfileModal;
