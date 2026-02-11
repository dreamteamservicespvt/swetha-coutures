import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Bill, 
  BillCreate,
  BillItem, 
  BillBreakdown, 
  BankDetails,
  generateBillId,
  generateUPILink,
  calculateBillTotals,
  generateQRCodeDataURL,
  calculateBillStatus
} from '@/utils/billingUtils';
import { toast } from '@/hooks/use-toast';
import BillFormAdvanced from '@/components/BillFormAdvanced';
import { v4 as uuidv4 } from 'uuid';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

// Helper function to convert order items to enhanced bill items
const convertOrderItemsToBillItems = async (orderData: any): Promise<BillItem[]> => {
  const billItems: BillItem[] = [];

  try {
    // Handle order items (if exists)
    if (orderData.items && Array.isArray(orderData.items)) {
      orderData.items.forEach((item: any, index: number) => {
        billItems.push({
          id: `item-${index}`,
          type: 'service', // Default to service, user can change via selector
          description: `${item.category} - ${item.description}`.trim(),
          quantity: item.quantity || 1,
          rate: 0, // To be filled by user
          cost: 0, // To be filled by user
          amount: 0
        });
      });
    }

    // Handle required materials (if exists)
    if (orderData.requiredMaterials && Array.isArray(orderData.requiredMaterials)) {
      for (const material of orderData.requiredMaterials) {
        if (material.inventoryId) {
          // Try to get inventory details
          try {
            const inventoryDoc = await getDoc(doc(db, 'inventory', material.inventoryId));
            if (inventoryDoc.exists()) {
              const inventoryData = inventoryDoc.data();
              billItems.push({
                id: uuidv4(),
                type: 'inventory',
                sourceId: material.inventoryId,
                description: inventoryData.name || material.materialName || 'Material',
                quantity: material.quantity || 1,
                rate: inventoryData.sellingPrice || (inventoryData.costPerUnit * 1.25), // 25% markup
                cost: inventoryData.costPerUnit || 0,
                amount: (inventoryData.sellingPrice || (inventoryData.costPerUnit * 1.25)) * (material.quantity || 1)
              });
            }
          } catch (error) {
            console.error('Error fetching inventory details:', error);
            // Fallback to generic material item
            billItems.push({
              id: uuidv4(),
              type: 'service',
              description: material.materialName || 'Material',
              quantity: material.quantity || 1,
              rate: 0,
              cost: 0,
              amount: 0
            });
          }
        }
      }
    }

    // Handle assigned staff (if exists)
    if (orderData.assignedStaff && Array.isArray(orderData.assignedStaff)) {
      for (const staffAssignment of orderData.assignedStaff) {
        try {
          const staffDoc = await getDoc(doc(db, 'staff', staffAssignment.id));
          if (staffDoc.exists()) {
            const staffData = staffDoc.data();
            billItems.push({
              id: uuidv4(),
              type: 'staff',
              sourceId: staffAssignment.id,
              description: `${staffData.name} - ${staffData.role || staffData.designation || 'Staff'}`,
              quantity: 1, // Can be hours or service instances
              rate: staffData.billingRate || 0,
              cost: staffData.costRate || 0,
              amount: staffData.billingRate || 0
            });
          }
        } catch (error) {
          console.error('Error fetching staff details:', error);
        }
      }
    }

    // If no items found, add a default item
    if (billItems.length === 0) {
      billItems.push({
        id: 'item-0',
        type: 'service',
        description: orderData.itemType || 'Custom Item',
        quantity: orderData.quantity || 1,
        rate: 0,
        cost: 0,
        amount: 0
      });
    }

    return billItems;
  } catch (error) {
    console.error('Error converting order items to bill items:', error);
    // Return default item on error
    return [{
      id: 'item-0',
      type: 'service',
      description: orderData.itemType || 'Custom Item',
      quantity: orderData.quantity || 1,
      rate: 0,
      cost: 0,
      amount: 0
    }];
  }
};

const NewBill = () => {
  const { billId, orderId } = useParams();
  const navigate = useNavigate();
  
  // Determine mode based on URL pattern
  const isEditing = !!billId && (window.location.pathname.includes('/edit') || window.location.pathname.startsWith('/billing/new/'));
  const isFromOrder = !!orderId && !billId;
  
  const [bill, setBill] = useState<Bill | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isEditing && billId) {
      fetchBill();
    } else if (isFromOrder && orderId) {
      fetchOrderData();
    } else {
      // Initialize with default values for new bill
      setInitialized(true);
    }
  }, [isEditing, billId, isFromOrder, orderId]);

  const fetchBill = async () => {
    if (!billId) return;
    
    setLoading(true);
    try {
      console.log('Fetching bill for editing with ID or number:', billId);
      
      // Try to get the bill directly first (assuming billId might be the document ID)
      let billDoc = await getDoc(doc(db, 'bills', billId));
      
      // If bill not found by ID, try querying by billId (bill number) as fallback
      if (!billDoc.exists()) {
        console.log('Bill not found by document ID, trying to find by bill number');
        // Check if the passed ID is a UUID (document ID) or a bill number (BILL123456)
        const isBillNumber = typeof billId === 'string' && billId.startsWith('BILL');
        
        if (isBillNumber) {
          // Search by billId field
          const billsQuery = query(
            collection(db, 'bills'),
            where('billId', '==', billId)
          );
          
          const querySnapshot = await getDocs(billsQuery);
          if (!querySnapshot.empty) {
            billDoc = querySnapshot.docs[0];
            console.log('Found bill by bill number:', billDoc.id);
          }
        } else {
          // If not a clear bill number, fetch all bills and search
          console.log('Searching all bills as fallback...');
          const allBillsQuery = query(collection(db, 'bills'));
          const allBills = await getDocs(allBillsQuery);
          
          // Look for any match in id or billId fields
          for (const doc of allBills.docs) {
            const data = doc.data();
            if (doc.id === billId || data.billId === billId || 
                doc.id.toLowerCase() === billId.toLowerCase() || 
                data.billId?.toLowerCase() === billId.toLowerCase()) {
              billDoc = doc;
              console.log('Found bill through comprehensive search:', billDoc.id);
              break;
            }
          }
        }
        
        // Update URL to use the document ID for future reference if we found the bill
        if (billDoc && billDoc.exists()) {
          const pathParts = window.location.pathname.split('/');
          if (pathParts.includes('edit')) {
            window.history.replaceState(null, '', `/billing/${billDoc.id}/edit`);
          } else {
            window.history.replaceState(null, '', `/billing/${billDoc.id}`);
          }
        }
      }
      
      if (billDoc && billDoc.exists()) {
        const billData = { id: billDoc.id, ...billDoc.data() } as Bill;
        console.log('Bill found for editing:', billData);
        setBill(billData);
      } else {
        console.error('Bill document not found for editing, ID:', billId);
        toast({
          title: "Error",
          description: `Bill not found. The bill with ID "${billId}" does not exist or may have been deleted.`,
          variant: "destructive",
        });
        navigate('/billing');
      }
    } catch (error) {
      console.error('Error fetching bill for editing:', error);
      toast({
        title: "Error",
        description: "Failed to fetch bill details for editing. Please check your connection and try again.",
        variant: "destructive",
      });
      navigate('/billing');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const fetchOrderData = async () => {
    if (!orderId) return;
    
    setLoading(true);
    try {
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (orderDoc.exists()) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as any;
        setOrderData(orderData);
        
        // Convert order to bill format for preloading with enhanced BillItem structure
        const preloadedBill: Partial<Bill> = {
          customerName: orderData.customerName || '',
          customerPhone: orderData.customerPhone || '',
          customerEmail: orderData.customerEmail || '',
          customerAddress: orderData.customerAddress || '',
          items: await convertOrderItemsToBillItems(orderData),
          breakdown: {
            fabric: 0,
            stitching: 0,
            accessories: 0,
            customization: 0,
            otherCharges: 0
          },
          subtotal: 0,
          gstPercent: 0,
          gstAmount: 0,
          discount: 0,
          discountType: 'amount',
          totalAmount: 0,
          paidAmount: 0,
          balance: 0,
          status: 'unpaid',
          date: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 1000),
          bankDetails: {
            accountName: 'Swetha\'s Couture',
            accountNumber: '',
            ifsc: '',
            bankName: ''
          },
          upiId: '',
          upiLink: '',
          qrCodeUrl: '',
          qrAmount: 0,
          notes: `Order #${orderData.orderNumber || orderData.orderId} - Delivery: ${orderData.deliveryDate}`,
          orderId: orderData.id
        };
        
        setBill(preloadedBill as Bill);
      } else {
        toast({
          title: "Error",
          description: "Order not found",
          variant: "destructive",
        });
        navigate('/orders');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: "Error",
        description: "Failed to fetch order details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const handleBillSave = async (billData: BillCreate) => {
    setLoading(true);
    
    try {
      console.log('Saving bill data to Firestore:', billData);
      
      // Deep sanitize the data to ensure no undefined values exist
      const sanitizeObject = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        
        if (obj instanceof Date) return obj;
        
        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject).filter(item => item !== null && item !== undefined);
        }
        
        if (typeof obj === 'object') {
          const sanitized: any = {};
          Object.keys(obj).forEach(key => {
            const value = sanitizeObject(obj[key]);
            if (value !== null && value !== undefined) {
              sanitized[key] = value;
            }
          });
          return sanitized;
        }
        
        return obj;
      };
      
      // Sanitize the bill data
      const sanitizedBillData = sanitizeObject(billData);
      
      // Ensure required fields are present
      if (!sanitizedBillData.billId) {
        const newBillId = await generateBillId();
        sanitizedBillData.billId = newBillId;
        
        // Extract numeric part for billNumber (remove # prefix)
        const billNumberMatch = newBillId.match(/(\d+)/);
        if (billNumberMatch) {
          sanitizedBillData.billNumber = parseInt(billNumberMatch[1]);
        }
      }
      
      if (isEditing && billId) {
        // Update existing bill - use serverTimestamp for updatedAt only
        const updateData = {
          ...sanitizedBillData,
          updatedAt: serverTimestamp(),
        };
        
        // Remove undefined fields before updating
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });
        
        await updateDoc(doc(db, 'bills', billId), updateData);
        
        toast({
          title: "✅ Success",
          description: `Bill ${sanitizedBillData.billId} updated successfully`,
        });
      } else {
        // Create new bill - use serverTimestamp for both createdAt and updatedAt
        const newBillData = {
          ...sanitizedBillData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        // Remove any undefined fields before saving
        Object.keys(newBillData).forEach(key => {
          if (newBillData[key] === undefined) {
            delete newBillData[key];
          }
        });
        
        console.log('Final bill data being saved:', newBillData);
        
        const docRef = await addDoc(collection(db, 'bills'), newBillData);
        
        toast({
          title: "✅ Success",
          description: isFromOrder 
            ? `Bill ${newBillData.billId} created from order successfully` 
            : `Bill ${newBillData.billId} created successfully`,
        });
        
        // If created from an order, update the order status
        if (isFromOrder && orderId) {
          try {
            await updateDoc(doc(db, 'orders', orderId), {
              billGenerated: true,
              billId: docRef.id,
              billNumber: newBillData.billId,
              updatedAt: serverTimestamp()
            });
          } catch (error) {
            console.error('Error updating order status:', error);
            // Don't fail the whole operation if order update fails
          }
        }
      }
      
      navigate('/billing');
    } catch (error) {
      console.error('Error saving bill:', error);
      toast({
        title: "❌ Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} bill. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      navigate('/billing');
    }
  };

  // Show loading state while fetching data
  if (loading && (isEditing || isFromOrder) && !initialized) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/billing')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            {isEditing ? 'Loading bill details...' : 'Loading order details...'}
          </p>
        </div>
      </div>
    );
  }

  // Don't render until initialized
  if (!initialized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800/50 overflow-x-hidden">
      {/* Header Navigation */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-border px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/billing')} size="sm" className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isEditing ? '✏️ Edit Bill' : isFromOrder ? '📄 Create Bill from Order' : '📄 Create New Bill'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isEditing 
                ? 'Update bill details and recalculate totals' 
                : isFromOrder 
                ? `Generate a bill for order ${orderData?.orderNumber || 'N/A'}`
                : 'Generate a professional bill for your customer'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <BillFormAdvanced
          billId={billId}
          bill={bill}
          onSave={handleBillSave}
          onCancel={handleCancel}
          isFromOrder={isFromOrder} // Pass the isFromOrder flag
          onSuccess={() => {
            toast({
              title: "🎉 Bill Saved",
              description: isFromOrder 
                ? "Bill created from order successfully!" 
                : "Your bill has been saved successfully!",
            });
            navigate('/billing');
          }}
        />
      </div>
    </div>
  );
};

export default NewBill;
