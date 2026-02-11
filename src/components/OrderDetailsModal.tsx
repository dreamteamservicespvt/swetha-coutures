
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Phone, MessageSquare, User, Package, Calendar, Ruler, FileText, Edit, Trash2, Receipt, Users, Package2, Eye, X } from 'lucide-react';
import { updateDoc, doc, serverTimestamp, deleteDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface OrderItem {
  madeFor: string;
  category: string;
  description: string;
  quantity: number;
  status: string;
  orderDate: string;
  deliveryDate: string;
  assignedStaff: string[];
  requiredMaterials: { id: string; name: string; quantity: number; unit: string; }[];
  designImages: string[];
  notes: string;
  sizes?: Record<string, string>;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items?: OrderItem[];
  itemType: string;
  quantity: number;
  status: string;
  orderDate: string;
  deliveryDate: string;
  measurements?: any;
  notes?: string;
  designImages?: string[];
  assignedStaff?: string[];
  requiredMaterials?: any[];
  totalAmount: number;
  remainingAmount: number;
  billGenerated?: boolean;
  billId?: string;
  billNumber?: string;
}

interface Staff {
  id: string;
  name: string;
  role: string;
  photoURL?: string;
}

interface Material {
  id: string;
  name: string;
  unit: string;
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onWhatsAppClick: (order: Order) => void;
  onEditClick?: (order: Order) => void;
  onRefresh: () => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  onClose,
  order,
  onWhatsAppClick,
  onEditClick,
  onRefresh
}) => {
  const navigate = useNavigate();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(order?.status || '');
  const [staffDetails, setStaffDetails] = useState<Staff[]>([]);
  const [materialDetails, setMaterialDetails] = useState<Material[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  useEffect(() => {
    if (order) {
      setCurrentStatus(order.status);
      fetchStaffDetails();
      fetchMaterialDetails();
    }
  }, [order]);

  const fetchStaffDetails = async () => {
    if (!order?.assignedStaff?.length) return;
    
    setLoadingStaff(true);
    try {
      const staffPromises = order.assignedStaff.map(async (staffId) => {
        const staffDoc = await getDoc(doc(db, 'staff', staffId));
        if (staffDoc.exists()) {
          return { id: staffId, ...staffDoc.data() } as Staff;
        }
        return { id: staffId, name: staffId, role: 'Unknown' } as Staff;
      });
      
      const staffData = await Promise.all(staffPromises);
      setStaffDetails(staffData);
    } catch (error) {
      console.error('Error fetching staff details:', error);
    } finally {
      setLoadingStaff(false);
    }
  };

  const fetchMaterialDetails = async () => {
    if (!order?.requiredMaterials?.length) return;
    
    setLoadingMaterials(true);
    try {
      const materialIds = order.requiredMaterials.map(mat => 
        typeof mat === 'string' ? mat : mat.id
      );
      
      const materialPromises = materialIds.map(async (materialId) => {
        const materialDoc = await getDoc(doc(db, 'inventory', materialId));
        if (materialDoc.exists()) {
          return { id: materialId, ...materialDoc.data() } as Material;
        }
        return { id: materialId, name: materialId, unit: 'pcs' } as Material;
      });
      
      const materialData = await Promise.all(materialPromises);
      setMaterialDetails(materialData);
    } catch (error) {
      console.error('Error fetching material details:', error);
    } finally {
      setLoadingMaterials(false);
    }
  };

  if (!order) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in-progress': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'ready': return 'bg-green-100 text-green-700 border-green-200';
      case 'delivered': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200 dark:border-gray-700';
    }
  };

  const updateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setCurrentStatus(newStatus);
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
      onRefresh();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'orders', order.id));
      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "Failed to delete order",
        variant: "destructive",
      });
    }
  };

  const handleBillClick = async () => {
    try {
      // First check if order already has a bill generated
      if (order.billGenerated && order.billId) {
        // Verify the bill still exists
        const { checkBillExists } = await import('@/utils/billingUtils');
        const billExists = await checkBillExists(order.billId);
        
        if (billExists) {
          // Navigate to existing bill details
          navigate(`/billing/${order.billId}`);
          onClose();
          return;
        } else {
          // Bill was deleted, reset order bill status
          console.warn('Bill was deleted, resetting order bill status');
          await updateDoc(doc(db, 'orders', order.id), {
            billGenerated: false,
            billId: null,
            billNumber: null,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      // Check if there's an existing bill for this order (by orderId)
      const { findBillByOrderId } = await import('@/utils/billingUtils');
      const existingBill = await findBillByOrderId(order.id);
      
      if (existingBill) {
        // Update order with bill information
        await updateDoc(doc(db, 'orders', order.id), {
          billGenerated: true,
          billId: existingBill.id,
          billNumber: existingBill.billId,
          updatedAt: serverTimestamp()
        });
        
        // Navigate to existing bill
        navigate(`/billing/${existingBill.id}`);
      } else {
        // Create new bill from order
        navigate(`/billing/new/${order.id}`);
      }
      
      onClose();
    } catch (error) {
      console.error('Error handling bill click:', error);
      toast({
        title: "Error",
        description: "Failed to process bill request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const orderItems = order.items || [];
  const hasMultipleItems = orderItems.length > 1;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="relative pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <DialogTitle>Order Details - #{order.orderNumber.slice(-4)}</DialogTitle>
                <Badge className={getStatusColor(currentStatus)} variant="outline">
                  {currentStatus.toUpperCase()}
                </Badge>
              </div>
            </div>
            
            {/* Action Buttons - Separated from header for better UX */}
            <div className="flex items-center space-x-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              {onEditClick && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEditClick(order)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleBillClick}
                className="text-blue-600 hover:bg-blue-50"
              >
                <Receipt className="h-4 w-4 mr-2" />
                Bill
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onWhatsAppClick(order)}
                className="text-green-600 hover:bg-green-50"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Name:</span> {order.customerName}
                </div>
                <div>
                  <span className="font-medium">Phone:</span> {order.customerPhone}
                </div>
                {order.customerEmail && (
                  <div>
                    <span className="font-medium">Email:</span> {order.customerEmail}
                  </div>
                )}
                <div className="flex space-x-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`tel:${order.customerPhone}`)}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onWhatsAppClick(order)}
                    className="text-green-600"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Order Information & Status Update */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Order Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Order ID:</span> {order.orderNumber}
                </div>
                <div>
                  <span className="font-medium">Item Type:</span> {order.itemType}
                </div>
                <div>
                  <span className="font-medium">Total Quantity:</span> {order.quantity}
                </div>
                <div>
                  <span className="font-medium">Order Date:</span> {order.orderDate}
                </div>
                <div>
                  <span className="font-medium">Delivery Date:</span> {order.deliveryDate}
                </div>
                <div className="pt-2">
                  <span className="font-medium">Update Status:</span>
                  <Select value={currentStatus} onValueChange={updateStatus} disabled={updatingStatus}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Assigned Staff */}
            {(order.assignedStaff && order.assignedStaff.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Assigned Staff
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingStaff ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">Loading staff details...</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {staffDetails.map((staff, index) => (
                        <div key={index} className="flex items-center space-x-2 bg-gray-50 rounded-full px-3 py-1">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={staff.photoURL} />
                            <AvatarFallback className="text-xs">
                              {staff.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="text-sm font-medium">{staff.name}</span>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{staff.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Items List */}
          {hasMultipleItems && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package2 className="h-5 w-5 mr-2" />
                  Order Items ({orderItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orderItems.map((item, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">Item {index + 1}</span>
                            <Badge variant="secondary">{item.category}</Badge>
                            {item.madeFor !== order.customerName && (
                              <Badge variant="outline" className="text-purple-600">
                                <User className="h-3 w-3 mr-1" />
                                {item.madeFor}
                              </Badge>
                            )}
                          </div>
                          <Badge className={getStatusColor(item.status)} variant="outline">
                            {item.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Description:</span> {item.description || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Quantity:</span> {item.quantity}
                          </div>
                          <div>
                            <span className="font-medium">Delivery:</span> {item.deliveryDate}
                          </div>
                        </div>
                        
                        {/* Item Materials */}
                        {item.requiredMaterials && item.requiredMaterials.length > 0 && (
                          <div className="mt-3">
                            <span className="font-medium text-sm">Required Materials:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.requiredMaterials.map((material, matIndex) => (
                                <Badge key={matIndex} variant="outline" className="text-xs">
                                  {material.name} ({material.quantity} {material.unit})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Item Sizes */}
                        {item.sizes && Object.keys(item.sizes).length > 0 && (
                          <div className="mt-3">
                            <span className="font-medium text-sm">Sizes:</span>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                              {Object.entries(item.sizes).map(([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="font-medium capitalize">{key.replace('_', ' ')}:</span> {value}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Item Images */}
                        {item.designImages && item.designImages.length > 0 && (
                          <div className="mt-3">
                            <span className="font-medium text-sm">Design Images:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {item.designImages.map((url, imgIndex) => (
                                <img
                                  key={imgIndex}
                                  src={url}
                                  alt={`Design ${imgIndex + 1}`}
                                  className="w-12 h-12 object-cover rounded cursor-pointer hover:scale-110 transition-transform"
                                  onClick={() => setSelectedImageUrl(url)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Item Notes */}
                        {item.notes && (
                          <div className="mt-3">
                            <span className="font-medium text-sm">Notes:</span>
                            <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Required Materials (for single item orders) */}
          {!hasMultipleItems && order.requiredMaterials && order.requiredMaterials.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package2 className="h-5 w-5 mr-2" />
                  Required Materials
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMaterials ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Loading material details...</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {materialDetails.map((material, index) => {
                      const originalMaterial = order.requiredMaterials[index];
                      const quantity = typeof originalMaterial === 'object' ? originalMaterial.quantity : 1;
                      const unit = typeof originalMaterial === 'object' ? originalMaterial.unit : material.unit;
                      
                      return (
                        <Badge key={index} variant="outline">
                          {material.name} - Qty: {quantity} {unit}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Measurements */}
          {order.measurements && Object.keys(order.measurements).length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Ruler className="h-5 w-5 mr-2" />
                  Measurements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(order.measurements).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="font-medium capitalize">{key.replace('_', ' ')}:</span> {value as string}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Design Images (for single item orders) */}
          {!hasMultipleItems && order.designImages && order.designImages.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Design Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {order.designImages.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Design ${index + 1}`}
                      className="w-full h-20 object-cover rounded cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setSelectedImageUrl(url)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {order.notes && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}

        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      {selectedImageUrl && (
        <Dialog open={!!selectedImageUrl} onOpenChange={() => setSelectedImageUrl(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Design Image</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={selectedImageUrl}
                alt="Design"
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default OrderDetailsModal;
