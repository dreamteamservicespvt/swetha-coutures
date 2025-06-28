
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit, MessageSquare, Phone, User, Calendar, Package, Trash2, Receipt } from 'lucide-react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog';
import { Order } from './OrdersPage';

interface OrdersGridViewProps {
  filteredOrders: Order[];
  handleViewOrder: (order: Order) => void;
  handleEditOrder: (order: Order) => void;
  handleSendWhatsApp: (order: Order) => void;
  onRefresh: () => void;
}

const OrdersGridView: React.FC<OrdersGridViewProps> = ({
  filteredOrders,
  handleViewOrder,
  handleEditOrder,
  handleSendWhatsApp,
  onRefresh
}) => {
  const navigate = useNavigate();
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; order: Order | null }>({
    isOpen: false,
    order: null
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in-progress': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'ready': return 'bg-green-100 text-green-700 border-green-200';
      case 'delivered': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getMadeForItems = (order: Order) => {
    if (!order.items || order.items.length === 0) return [order.customerName];
    return [...new Set(order.items.map(item => item.madeFor || order.customerName))];
  };

  const handleDeleteClick = (order: Order) => {
    setDeleteDialog({ isOpen: true, order });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.order) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'orders', deleteDialog.order.id));
      toast({
        title: "Success",
        description: `Order #${deleteDialog.order.orderNumber.slice(-4)} deleted successfully`,
      });
      onRefresh();
      setDeleteDialog({ isOpen: false, order: null });
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "Failed to delete order",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    if (!isDeleting) {
      setDeleteDialog({ isOpen: false, order: null });
    }
  };

  const handleBillClick = async (order: Order) => {
    try {
      // First check if order already has a bill generated
      if (order.billGenerated && order.billId) {
        // Verify the bill still exists
        const { checkBillExists } = await import('@/utils/billingUtils');
        const billExists = await checkBillExists(order.billId);
        
        if (billExists) {
          // Navigate to existing bill details
          navigate(`/billing/${order.billId}`);
          return;
        } else {
          // Bill was deleted, reset order bill status
          console.warn('Bill was deleted, resetting order bill status');
          const { updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          
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
        const { updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
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
    } catch (error) {
      console.error('Error handling bill click:', error);
      toast({
        title: "Error",
        description: "Failed to process bill request. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredOrders.map(order => {
          const madeForItems = getMadeForItems(order);
          return (
            <Card 
              key={order.id} 
              className="hover:shadow-lg transition-all duration-200 border border-gray-200 rounded-xl shadow-sm hover:shadow-xl"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-lg">#{order.orderNumber.slice(-4)}</span>
                      <Badge className={`${getStatusColor(order.status)} font-medium`} variant="outline">
                        {order.status}
                      </Badge>
                    </div>
                    <div className="text-xl font-semibold text-gray-900 truncate">{order.customerName}</div>
                  </div>
                  <div className="text-right text-sm text-gray-500 ml-2 flex-shrink-0">
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span className="text-xs">{order.orderDate}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Package className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate flex-1">{order.itemType}</span>
                    {order.quantity > 1 && (
                      <Badge variant="outline" className="text-xs ml-2 flex-shrink-0 bg-blue-50 text-blue-600">
                        Qty: {order.quantity}
                      </Badge>
                    )}
                  </div>
                  
                  {madeForItems.length > 1 || (madeForItems[0] !== order.customerName) && (
                    <div className="flex items-start text-sm">
                      <User className="h-4 w-4 mr-2 mt-0.5 text-purple-600 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                        {madeForItems.map((person, index) => (
                          <Badge key={index} variant="outline" className="text-purple-600 bg-purple-50 text-xs truncate max-w-full">
                            {person}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Delivery:</span>
                    <span className="font-medium text-xs">{order.deliveryDate}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  {/* First Actions Row - 2 buttons */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewOrder(order)}
                      className="text-xs flex items-center justify-center hover:bg-blue-50 hover:border-blue-200 transition-colors h-9 font-medium"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      View
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditOrder(order)}
                      className="text-xs flex items-center justify-center hover:bg-green-50 hover:border-green-200 transition-colors h-9 font-medium"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>
                  </div>

                  {/* Second Actions Row - 2 buttons */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBillClick(order)}
                      className="text-blue-600 hover:bg-blue-50 hover:border-blue-200 text-xs flex items-center justify-center transition-colors h-9 font-medium"
                    >
                      <Receipt className="h-3.5 w-3.5 mr-1.5" />
                      Bill
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendWhatsApp(order)}
                      className="text-green-600 hover:bg-green-50 hover:border-green-200 text-xs flex items-center justify-center transition-colors h-9 font-medium"
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                      WhatsApp
                    </Button>
                  </div>

                  {/* Third Actions Row - 2 buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`tel:${order.customerPhone}`)}
                      className="text-purple-600 hover:bg-purple-50 hover:border-purple-200 text-xs flex items-center justify-center transition-colors h-9 font-medium"
                    >
                      <Phone className="h-3.5 w-3.5 mr-1.5" />
                      Call
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteClick(order)}
                      className="text-red-600 hover:bg-red-50 hover:border-red-200 text-xs flex items-center justify-center transition-colors h-9 font-medium"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        orderNumber={deleteDialog.order?.orderNumber || ''}
        isDeleting={isDeleting}
      />
    </>
  );
};

export default OrdersGridView;
