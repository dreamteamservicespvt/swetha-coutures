
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit, MessageSquare, Phone, Calendar, Package, User, Trash2, Receipt } from 'lucide-react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog';
import { Order } from './OrdersPage';

interface OrdersListViewProps {
  filteredOrders: Order[];
  handleViewOrder: (order: Order) => void;
  handleEditOrder: (order: Order) => void;
  handleSendWhatsApp: (order: Order) => void;
  onRefresh: () => void;
}

const OrdersListView: React.FC<OrdersListViewProps> = ({
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
      default: return 'bg-gray-100 text-gray-700 border-gray-200 dark:border-gray-700';
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Orders List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Horizontal scroll wrapper with enhanced scrolling */}
          <div className="table-horizontal-scroll">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Made For</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOrders.map(order => {
                  const madeForItems = getMadeForItems(order);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 dark:bg-gray-800/50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            #{order.orderNumber.slice(-4)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{order.customerName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{order.customerPhone}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-2 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-900 truncate max-w-[120px]" title={order.itemType}>
                              {order.itemType}
                            </div>
                            {order.quantity > 1 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">Qty: {order.quantity}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {madeForItems.map((person, index) => (
                            <Badge key={index} variant="outline" className="text-purple-600 bg-purple-50 text-xs truncate">
                              {person}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge className={`${getStatusColor(order.status)} font-medium`} variant="outline">
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center mb-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span className="truncate">Order: {order.orderDate}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span className="truncate">Delivery: {order.deliveryDate}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium">
                        <div className="action-buttons">
                          {/* Primary Actions - Always visible */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewOrder(order)}
                            className="text-xs px-3 py-1.5 h-8 hover:bg-blue-50 hover:border-blue-200 text-blue-600"
                            title="View Order Details"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendWhatsApp(order)}
                            className="text-green-600 text-xs px-3 py-1.5 h-8 hover:bg-green-50 hover:border-green-200"
                            title="Send WhatsApp Message"
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Message
                          </Button>
                          
                          {/* Secondary Actions - Show on larger screens */}
                          <div className="hidden xl:contents">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditOrder(order)}
                              className="text-xs px-2 py-1.5 h-8 hover:bg-green-50 hover:border-green-200 text-green-600"
                              title="Edit Order"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleBillClick(order)}
                              className="text-blue-600 text-xs px-2 py-1.5 h-8 hover:bg-blue-50 hover:border-blue-200"
                              title="Create Bill"
                            >
                              <Receipt className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`tel:${order.customerPhone}`)}
                              className="text-xs px-2 py-1.5 h-8 hover:bg-gray-50 hover:border-gray-200 text-gray-600 dark:text-gray-400"
                              title="Call Customer"
                            >
                              <Phone className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteClick(order)}
                              className="text-red-600 text-xs px-2 py-1.5 h-8 hover:bg-red-50 hover:border-red-200"
                              title="Delete Order"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Dropdown menu for medium screens */}
                          <div className="xl:hidden">
                            <select
                              className="text-xs px-2 py-1 border rounded hover:bg-gray-50 min-w-[80px]"
                              onChange={(e) => {
                                const action = e.target.value;
                                if (action === 'edit') handleEditOrder(order);
                                else if (action === 'bill') handleBillClick(order);
                                else if (action === 'call') window.open(`tel:${order.customerPhone}`);
                                else if (action === 'delete') handleDeleteClick(order);
                                e.target.value = ''; // Reset selection
                              }}
                              defaultValue=""
                            >
                              <option value="" disabled>More</option>
                              <option value="edit">Edit</option>
                              <option value="bill">Bill</option>
                              <option value="call">Call</option>
                              <option value="delete">Delete</option>
                            </select>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
           
          </div>
        </CardContent>
      </Card>

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

export default OrdersListView;
