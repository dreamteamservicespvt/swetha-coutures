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

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

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
        
        // Convert order to bill format for preloading
        const preloadedBill: Partial<Bill> = {
          customerName: orderData.customerName || '',
          customerPhone: orderData.customerPhone || '',
          customerEmail: orderData.customerEmail || '',
          customerAddress: orderData.customerAddress || '',
          items: orderData.items?.map((item: any, index: number) => ({
            id: `item-${index}`,
            description: `${item.category} - ${item.description}`.trim(),
            quantity: item.quantity || 1,
            rate: 0, // To be filled by user
            amount: 0,
            notes: item.notes || ''
          })) || [{
            id: 'item-0',
            description: orderData.itemType || 'Custom Item',
            quantity: orderData.quantity || 1,
            rate: 0,
            amount: 0,
            notes: ''
          }],
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
      if (isEditing && billId) {
        // Update existing bill
        await updateDoc(doc(db, 'bills', billId), {
          ...billData,
          updatedAt: serverTimestamp(),
        });
        
        toast({
          title: "✅ Success",
          description: `Bill ${billData.billId} updated successfully`,
        });
      } else {
        // Create new bill
        const newBillData = {
          ...billData,
          billId: billData.billId || generateBillId(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
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
          <p className="mt-4 text-gray-500">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header Navigation */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/billing')} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {isEditing ? '✏️ Edit Bill' : isFromOrder ? '📄 Create Bill from Order' : '📄 Create New Bill'}
            </h1>
            <p className="text-sm text-gray-500">
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
