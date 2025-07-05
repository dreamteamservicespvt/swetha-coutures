import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, QrCode, MessageSquare, Calculator, FileText, CreditCard, Smartphone } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
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
  calculateBillStatus,
  formatCurrency
} from '@/utils/billingUtils';
import { getPaymentSettings } from '@/utils/settingsUtils';
import CustomerAutoSuggest from '@/components/CustomerAutoSuggest';
import BillWorkAndMaterials, { WorkItem, MaterialItem } from '@/components/BillWorkAndMaterials';
import PaymentModeInput, { PaymentRecord } from '@/components/PaymentModeInput';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

interface Order {
  id: string;
  orderId: string;
  customerName: string;
  items: any[];
  totalAmount: number;
}

interface InventoryItem {
  id: string;
  itemName: string;
  stockQty: number;
  category?: string;
  unitPrice?: number;
}

interface BillFormAdvancedProps {
  billId?: string;
  bill?: Bill | null;
  onSave: (billData: BillCreate) => void;
  onCancel: () => void;
  onSuccess?: () => void;
  isFromOrder?: boolean; // New prop to indicate this bill is being created from an order
}

const BillFormAdvanced: React.FC<BillFormAdvancedProps> = ({
  billId,
  bill,
  onSave,
  onCancel,
  onSuccess,
  isFromOrder = false // Default to false for backward compatibility
}) => {
  // Form state
  const [formData, setFormData] = useState<Partial<Bill>>({
    billId: generateBillId(),
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    orderId: '',
    items: [],
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
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 1000), // 7 days from now
    bankDetails: {
      accountName: 'Swetha\'s Couture',
      accountNumber: 'Loading...',
      ifsc: 'Loading...',
      bankName: 'Loading...'
    },
    upiId: 'Loading...',
    qrAmount: 0,
    notes: ''
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [chargeTypes, setChargeTypes] = useState<string[]>([
    'Fabric Cost', 'Stitching Charges', 'Accessories', 'Customization', 'Delivery Charges', 'Other'
  ]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [upiLink, setUpiLink] = useState('');
  const [loading, setLoading] = useState(false);

  // Work items state
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  // Keep empty materialItems for compatibility
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  // Enhanced bill items state
  const [enhancedBillItems, setEnhancedBillItems] = useState<BillItem[]>([]);

  // Fetch data on mount
  useEffect(() => {
    fetchCustomers();
    fetchOrders();
    fetchInventory();
    loadPaymentSettings(); // Load dynamic payment settings
    
    // Initialize with bill data if provided, otherwise use defaults
    if (bill) {
      setFormData({
        ...formData,
        ...bill,
        // Ensure breakdown is never undefined
        breakdown: bill.breakdown || {
          fabric: 0,
          stitching: 0,
          accessories: 0,
          customization: 0,
          otherCharges: 0
        },
        // Ensure bankDetails is never undefined
        bankDetails: bill.bankDetails || {
          accountName: 'Swetha\'s Couture',
          accountNumber: '',
          ifsc: '',
          bankName: ''
        }
      });
      setSelectedCustomer({
        id: bill.customerId || '',
        name: bill.customerName,
        phone: bill.customerPhone,
        email: bill.customerEmail || '',
        address: bill.customerAddress || ''
      });
      
      // Convert existing bill items to both enhanced bill items and legacy work items
      if (bill.items) {
        const work: WorkItem[] = [];
        const enhancedItems: BillItem[] = [];
        
        bill.items.forEach(item => {
          // Add to enhanced bill items (with full structure)
          enhancedItems.push({
            id: item.id,
            type: item.type || 'service',
            sourceId: item.sourceId,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            cost: item.cost || 0,
            amount: item.amount,
            chargeType: item.chargeType,
            materialName: item.materialName,
            materialCost: item.materialCost,
            inventoryId: item.inventoryId,
            subItems: item.subItems || [],
            parentId: item.parentId,
            isSubItem: item.isSubItem || false
          });
          
          // Also add to legacy work items for backward compatibility
          if (!item.inventoryId && !item.materialName) {
            work.push({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount
            });
          }
        });
        
        setEnhancedBillItems(enhancedItems);
        setWorkItems(work);
        setMaterialItems([]);
      }
    } else {
      // Ensure default initialization has proper breakdown
      setFormData(prev => ({
        ...prev,
        breakdown: {
          fabric: 0,
          stitching: 0,
          accessories: 0,
          customization: 0,
          otherCharges: 0
        },
        bankDetails: {
          accountName: 'Swetha\'s Couture',
          accountNumber: '',
          ifsc: '',
          bankName: ''
        }
      }));
    }
  }, [bill]);

  // Recalculate totals when enhanced bill items change
  useEffect(() => {
    // Use enhanced bill items if available, otherwise convert work items for backward compatibility
    const allItems: BillItem[] = enhancedBillItems.length > 0 ? enhancedBillItems : [
      ...workItems.map(item => ({
        id: item.id,
        type: 'service' as const,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        cost: 0,
        amount: item.amount,
        chargeType: 'Work'
      }))
    ];

    const totals = calculateBillTotals(
      allItems,
      formData.breakdown || { fabric: 0, stitching: 0, accessories: 0, customization: 0, otherCharges: 0 },
      formData.gstPercent || 0,
      formData.discount || 0,
      formData.discountType || 'amount'
    );

    const balance = totals.totalAmount - (formData.paidAmount || 0);
    const status = calculateBillStatus(totals.totalAmount, formData.paidAmount || 0);

    setFormData(prev => ({
      ...prev,
      items: allItems,
      subtotal: totals.subtotal,
      gstAmount: totals.gstAmount,
      totalAmount: totals.totalAmount,
      balance: Math.max(0, balance),
      status,
      // Auto-set QR amount to balance if not manually set
      qrAmount: prev.qrAmount === 0 ? Math.max(0, balance) : prev.qrAmount
    }));
  }, [enhancedBillItems, workItems, formData.gstPercent, formData.discount, formData.discountType, formData.paidAmount]);

  // Load dynamic payment settings from business settings
  const loadPaymentSettings = async () => {
    try {
      const paymentSettings = await getPaymentSettings();
      setFormData(prev => ({
        ...prev,
        upiId: paymentSettings.upiId || 'swethascouture@paytm',
        bankDetails: paymentSettings.bankDetails || {
          accountName: 'Swetha\'s Couture',
          accountNumber: '1234567890',
          ifsc: 'HDFC0001234',
          bankName: 'HDFC Bank'
        }
      }));
    } catch (error) {
      console.error('Error loading payment settings:', error);
      // Use fallback values if loading fails
      setFormData(prev => ({
        ...prev,
        upiId: 'swethascouture@paytm',
        bankDetails: {
          accountName: 'Swetha\'s Couture',
          accountNumber: '1234567890',
          ifsc: 'HDFC0001234',
          bankName: 'HDFC Bank'
        }
      }));
      
      toast({
        title: "Settings Notice",
        description: "Using default payment settings. Please update in Settings page.",
        variant: "default"
      });
    }
  };

  const fetchCustomers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'customers'));
      const customerList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customerList);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
      const orderList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(orderList);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchInventory = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'inventory'));
      
      // Map the inventory data properly according to what InventoryItemSelector expects
      const inventoryList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          itemName: data.name || data.itemName || 'Unnamed Item',
          stockQty: data.quantity || data.stockQty || 0,
          category: data.category || '',
          unitPrice: data.costPerUnit || data.unitPrice || 0
        } as InventoryItem;
      });
      
      console.log('Fetched inventory items:', inventoryList);
      setInventory(inventoryList);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory items. Please check your connection.",
        variant: "destructive"
      });
    }
  };

  // Calculate totals whenever relevant fields change
  useEffect(() => {
    // Use enhanced bill items if available, otherwise fall back to legacy items
    const itemsToUse = enhancedBillItems.length > 0 ? enhancedBillItems : formData.items || [];
    
    const { subtotal, gstAmount, totalAmount } = calculateBillTotals(
      itemsToUse,
      formData.breakdown || { fabric: 0, stitching: 0, accessories: 0, customization: 0, otherCharges: 0 },
      formData.gstPercent || 0,
      formData.discount || 0,
      formData.discountType || 'amount'
    );

    const balance = Math.max(0, totalAmount - (formData.paidAmount || 0));
    const status = calculateBillStatus(totalAmount, formData.paidAmount || 0);

    // Always default QR amount to balance unless user has explicitly changed it
    // If qrAmount is undefined, null, 0, or equal to previous balance, update it
    const shouldUpdateQrAmount = 
      formData.qrAmount === undefined || 
      formData.qrAmount === null || 
      formData.qrAmount === 0 ||
      formData.qrAmount === formData.balance;

    setFormData(prev => ({
      ...prev,
      subtotal,
      gstAmount,
      totalAmount,
      balance,
      status,
      // Default QR amount to balance for easy payment
      qrAmount: shouldUpdateQrAmount ? balance : prev.qrAmount
    }));
  }, [
    formData.items,
    enhancedBillItems,
    formData.breakdown,
    formData.gstPercent,
    formData.discount,
    formData.discountType,
    formData.paidAmount
  ]);

  // Fetch order details for UPI message
  const [orderDetails, setOrderDetails] = useState<{
    orderName?: string;
    madeFor?: string;
    orderId?: string;
    deliveryDate?: string;
  }>({});

  // Fetch order details if we have an orderId
  useEffect(() => {
    if (formData.orderId) {
      const fetchOrderDetails = async () => {
        try {
          const orderDoc = await getDoc(doc(db, 'orders', formData.orderId));
          if (orderDoc.exists()) {
            const data = orderDoc.data();
            
            const deliveryDate = data.deliveryDate?.toDate 
              ? new Date(data.deliveryDate.toDate()).toLocaleDateString('en-IN') 
              : data.deliveryDate instanceof Date 
                ? data.deliveryDate.toLocaleDateString('en-IN')
                : undefined;
                
            setOrderDetails({
              orderName: data.orderName || data.description,
              madeFor: data.customerName,
              orderId: data.orderId,
              deliveryDate
            });
          }
        } catch (error) {
          console.error('Error fetching order details:', error);
        }
      };
      
      fetchOrderDetails();
    }
  }, [formData.orderId]);

  // Generate UPI link and QR code
  const generateUpiAndQr = useCallback(async () => {
    if (formData.upiId && formData.customerName && (formData.qrAmount || 0) > 0 && formData.billId) {
      const newUpiLink = await generateUPILink(
        formData.upiId,
        formData.customerName,
        formData.qrAmount || formData.balance || 0,
        formData.billId,
        orderDetails.orderName,
        orderDetails.madeFor,
        orderDetails.orderId,
        orderDetails.deliveryDate
      );
      setUpiLink(newUpiLink);

      try {
        const qrUrl = await generateQRCodeDataURL(newUpiLink);
        setQrCodeUrl(qrUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
        toast({
          title: "QR Code Generation Failed",
          description: "Could not generate QR code. Please try again.",
          variant: "destructive"
        });
      }
    }
  }, [
    formData.upiId, 
    formData.customerName, 
    formData.qrAmount, 
    formData.billId, 
    formData.balance,
    orderDetails.orderName,
    orderDetails.madeFor,
    orderDetails.orderId,
    orderDetails.deliveryDate
  ]);

  useEffect(() => {
    generateUpiAndQr();
  }, [generateUpiAndQr]);

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email || '',
      customerAddress: customer.address || ''
    }));
    
    // Filter orders for this customer
    const customerOrders = orders.filter(order => 
      order.customerName.toLowerCase() === customer.name.toLowerCase()
    );
  };

  const handleOrderSelect = (orderId: string) => {
    const selectedOrder = orders.find(order => order.id === orderId);
    if (selectedOrder) {
      setFormData(prev => ({
        ...prev,
        orderId: selectedOrder.orderId,
        items: selectedOrder.items.map(item => ({
          id: uuidv4(),
          type: 'service' as const,
          description: item.description || item.type,
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          cost: 0,
          amount: item.amount || 0,
          chargeType: 'Order Item'
        }))
      }));
    }
  };

  const updateBreakdown = (field: keyof BillBreakdown, value: number) => {
    setFormData(prev => ({
      ...prev,
      breakdown: {
        ...prev.breakdown!,
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.customerName?.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive"
      });
      return;
    }
    
    if (!formData.customerPhone?.trim()) {
      toast({
        title: "Validation Error", 
        description: "Customer phone is required",
        variant: "destructive"
      });
      return;
    }
    
    if (workItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one work item or material item is required",
        variant: "destructive"
      });
      return;
    }
    
    // Validate that all items have description and positive rates
    const invalidItems = formData.items.filter(item => 
      !item.description?.trim() || item.rate <= 0 || item.quantity <= 0
    );
    
    if (invalidItems.length > 0) {
      toast({
        title: "Validation Error",
        description: "All items must have a description, positive rate, and quantity",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);

    try {
      // Ensure UPI link and QR code are properly generated before saving
      let finalUpiLink = '';
      let finalQrCodeUrl = '';
      
      if (formData.upiId && formData.customerName && (formData.qrAmount || 0) > 0 && formData.billId) {
        finalUpiLink = await generateUPILink(
          formData.upiId,
          formData.customerName,
          formData.qrAmount || formData.balance || 0,
          formData.billId,
          orderDetails.orderName,
          orderDetails.madeFor,
          orderDetails.orderId,
          orderDetails.deliveryDate
        );
        
        try {
          finalQrCodeUrl = await generateQRCodeDataURL(finalUpiLink);
        } catch (error) {
          console.error('Error generating QR code during save:', error);
          finalQrCodeUrl = '';
        }
      }

      // Ensure breakdown is properly initialized
      const safeBreakdown: BillBreakdown = {
        fabric: formData.breakdown?.fabric || 0,
        stitching: formData.breakdown?.stitching || 0,
        accessories: formData.breakdown?.accessories || 0,
        customization: formData.breakdown?.customization || 0,
        otherCharges: formData.breakdown?.otherCharges || 0
      };

      // Ensure bank details are properly initialized
      const safeBankDetails: BankDetails = {
        accountName: formData.bankDetails?.accountName || 'Swetha\'s Couture',
        accountNumber: formData.bankDetails?.accountNumber || '',
        ifsc: formData.bankDetails?.ifsc || '',
        bankName: formData.bankDetails?.bankName || ''
      };

      const billData: BillCreate = {
        billId: formData.billId!,
        customerId: formData.customerId || selectedCustomer?.id || '',
        customerName: formData.customerName!,
        customerPhone: formData.customerPhone!,
        customerEmail: formData.customerEmail || '',
        customerAddress: formData.customerAddress || '',
        orderId: formData.orderId || '',
        items: formData.items || [],
        breakdown: safeBreakdown,
        subtotal: formData.subtotal || 0,
        gstPercent: formData.gstPercent || 0,
        gstAmount: formData.gstAmount || 0,
        discount: formData.discount || 0,
        discountType: formData.discountType || 'amount',
        totalAmount: formData.totalAmount || 0,
        paidAmount: formData.paidAmount || 0,
        balance: formData.balance || 0,
        status: formData.status || 'unpaid',
        date: formData.date || new Date(),
        dueDate: formData.dueDate || new Date(Date.now() + 7 * 24 * 60 * 1000),
        bankDetails: safeBankDetails,
        upiId: formData.upiId || '',
        upiLink: finalUpiLink,
        qrCodeUrl: finalQrCodeUrl,
        qrAmount: formData.qrAmount || formData.balance || 0,
        notes: formData.notes || '',
        createdAt: bill?.createdAt || new Date(),
        updatedAt: new Date()
      };

      console.log('Saving bill data:', billData);
      
      // Handle inventory deduction for inventory items
      if (billData.items && billData.items.length > 0) {
        const inventoryItems = billData.items.filter(item => item.type === 'inventory' && item.sourceId);
        
        if (inventoryItems.length > 0) {
          try {
            // Import and use the inventory helper function
            const { deductInventoryForBillItems } = await import('@/utils/inventoryMaterialsHelper');
            
            // Convert bill items to the format expected by the helper
            const itemsForDeduction = inventoryItems.map(item => ({
              inventoryId: item.sourceId,
              materialName: item.description,
              quantity: item.quantity
            }));
            
            const deductionResult = await deductInventoryForBillItems(itemsForDeduction);
            
            if (!deductionResult.success) {
              // Show warning but don't prevent bill creation
              toast({
                title: "Inventory Warning",
                description: `Some inventory items couldn't be deducted: ${deductionResult.messages.join(', ')}`,
                variant: "destructive"
              });
            } else {
              // Show success message for inventory deduction
              toast({
                title: "Inventory Updated",
                description: `Successfully deducted ${inventoryItems.length} inventory items`,
              });
            }
          } catch (inventoryError) {
            console.error('Error deducting inventory:', inventoryError);
            // Continue with bill creation even if inventory deduction fails
            toast({
              title: "Inventory Warning",
              description: "Bill saved but inventory couldn't be updated. Please check manually.",
              variant: "destructive"
            });
          }
        }
      }
      
      await onSave(billData);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving bill:', error);
      toast({
        title: "Error",
        description: "Failed to save bill. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {bill ? 'Edit Bill' : (isFromOrder ? 'Create Bill from Order' : 'Create New Bill')}
        </h1>
        <p className="text-purple-100">
          {bill 
            ? 'Update bill details and recalculate totals' 
            : isFromOrder 
            ? 'Review and complete the bill details from the selected order'
            : 'Generate a professional bill for your customer'
          }
        </p>
        {isFromOrder && (
          <div className="mt-3 p-3 bg-blue-500/20 rounded-lg border border-blue-400/30">
            <p className="text-sm text-blue-100">
              ✨ Order details have been pre-filled. Review the information and add pricing to complete the bill.
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Order Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Customer & Order Details
              {bill && !isEditingCustomer && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingCustomer(true)}
                >
                  Change Customer
                </Button>
              )}
            </CardTitle>
            {bill && !isEditingCustomer && (
              <p className="text-sm text-gray-600">
                You are editing Bill #{formData.billId}. Customer details are locked.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {(!bill || isEditingCustomer) ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <CustomerAutoSuggest
                    value={formData.customerName || ''}
                    onChange={(value) => setFormData(prev => ({ ...prev, customerName: value }))}
                    onCustomerSelect={handleCustomerSelect}
                    placeholder="Type customer name..."
                  />
                </div>
                <div>
                  <Label>Select Order (Optional)</Label>
                  <Select onValueChange={handleOrderSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Link to existing order" />
                    </SelectTrigger>
                    <SelectContent>
                      {orders
                        .filter(order => 
                          !selectedCustomer || 
                          order.customerName.toLowerCase() === selectedCustomer.name.toLowerCase()
                        )
                        .map(order => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.orderId || order.id} - {formatCurrency(order.totalAmount || 0)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name</Label>
                  <Input value={formData.customerName} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={formData.customerPhone} readOnly className="bg-gray-50" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.customerPhone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="Customer phone"
                  required
                />
              </div>
              <div>
                <Label>Email (Optional)</Label>
                <Input
                  value={formData.customerEmail || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                  placeholder="Customer email"
                  type="email"
                />
              </div>
            </div>

            <div>
              <Label>Address (Optional)</Label>
              <Input
                value={formData.customerAddress || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, customerAddress: e.target.value }))}
                placeholder="Customer address"
              />
            </div>
          </CardContent>
        </Card>

        {/* Work Section (Materials section has been removed) */}
        <BillWorkAndMaterials
          workItems={workItems}
          materialItems={materialItems}
          onWorkItemsChange={setWorkItems}
          onMaterialItemsChange={setMaterialItems}
          onBillItemsChange={setEnhancedBillItems}
          initialBillItems={enhancedBillItems}
        />

        {/* Payment Calculation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>GST % (Optional)</Label>
                  <Input
                    type="number"
                    value={formData.gstPercent === 0 ? '' : formData.gstPercent}
                    onChange={(e) => setFormData(prev => ({ ...prev, gstPercent: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    min="0"
                    max="30"
                    step="0.1"
                    placeholder="Enter GST %"
                  />
                </div>              <div>
                <Label>Discount (₹)</Label>
                <Input
                  type="number"
                  value={formData.discount === 0 ? '' : formData.discount}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value === '' ? 0 : Number(e.target.value) }))}
                  min="0"
                  step="0.01"
                  placeholder="Enter discount amount"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Tracking Section */}
        <PaymentModeInput
          totalAmount={formData.totalAmount || 0}
          currentPaidAmount={formData.paidAmount || 0}
          onPaymentChange={(paidAmount, paymentRecords, totalCash, totalOnline) => {
            setFormData(prev => ({
              ...prev,
              paidAmount,
              paymentRecords,
              totalCashReceived: totalCash,
              totalOnlineReceived: totalOnline
            }));
          }}
          initialPaymentRecords={formData.paymentRecords || []}
        />

        {/* Payment Details Section */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>QR Code Amount (₹)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={formData.qrAmount === 0 ? '' : formData.qrAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, qrAmount: e.target.value === '' ? 0 : Number(e.target.value) }))}
                  min="0"
                  step="0.01"
                  placeholder={`Auto-set to balance (₹${formData.balance || 0})`}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setFormData(prev => ({ ...prev, qrAmount: prev.balance || 0 }))}
                  className="whitespace-nowrap"
                  disabled={!formData.balance || formData.balance === 0}
                >
                  Use Balance
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Amount for QR code payment. Balance: ₹{formData.balance || 0}. Auto-updates with balance or edit manually.
              </p>
            </div>

            {/* QR Code Display */}
            {qrCodeUrl && (
              <div className="text-center p-4 bg-muted/20 dark:bg-muted/10 rounded-lg border">
                <Label className="text-sm font-medium">UPI QR Code</Label>
                <div className="mt-2">
                  <img src={qrCodeUrl} alt="UPI QR Code" className="w-32 h-32 mx-auto border border-border rounded" />
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Scan to pay {formatCurrency(formData.qrAmount || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      UPI ID: {formData.upiId}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

          {/* Right: Summary & Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(formData.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>GST ({formData.gstPercent || 0}%):</span>
                  <span>{formatCurrency(formData.gstAmount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span>-{formatCurrency(formData.discount || 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Amount:</span>
                  <span className="text-purple-600 dark:text-purple-400">{formatCurrency(formData.totalAmount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid Amount:</span>
                  <span className="text-green-600 dark:text-green-400">{formatCurrency(formData.paidAmount || 0)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Balance:</span>
                  <span className={(formData.balance || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                    {formatCurrency(formData.balance || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Status:</span>
                  <Badge 
                    className={
                      formData.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      formData.status === 'partial' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }
                  >
                    {formData.status?.charAt(0).toUpperCase() + formData.status?.slice(1)}
                  </Badge>
                </div>
              </div>

              {/* Pay with UPI Button */}
              <div className="pt-4 border-t border-border">
                <Button
                  type="button"
                  onClick={async () => {
                    // Generate UPI link on-the-fly if needed
                    if (!formData.upiLink && formData.upiId && formData.customerName && formData.billId) {
                      const dynamicUpiLink = await generateUPILink(
                        formData.upiId,
                        formData.customerName,
                        formData.qrAmount || formData.balance || 0,
                        formData.billId,
                        orderDetails.orderName,
                        orderDetails.madeFor,
                        orderDetails.orderId,
                        orderDetails.deliveryDate
                      );
                      window.open(dynamicUpiLink, '_blank');
                    } else if (formData.upiLink) {
                      window.open(formData.upiLink, '_blank');
                    } else {
                      toast({
                        title: "UPI Link Not Available",
                        description: "Please complete customer and payment details first",
                        variant: "default"
                      });
                    }
                  }}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white dark:from-green-700 dark:to-emerald-700 dark:hover:from-green-800 dark:hover:to-emerald-800"
                  // Enable button if we have necessary info to generate UPI link
                  disabled={!formData.upiId || !formData.customerName || !formData.billId}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Pay with UPI
                </Button>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Opens UPI apps with pre-filled payment details
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="sm:order-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !formData.customerName?.trim() || !formData.customerPhone?.trim() || workItems.length === 0}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              isFromOrder ? 'Create Bill from Order' : (bill ? 'Update Bill' : 'Create Bill')
            )}
          </Button>
        </div>
        
        {/* Validation hints */}
        {(!formData.customerName?.trim() || !formData.customerPhone?.trim() || workItems.length === 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">
              {isFromOrder ? 'Please complete the bill details:' : 'Required fields missing:'}
            </h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              {!formData.customerName?.trim() && <li>• Customer name is required</li>}
              {!formData.customerPhone?.trim() && <li>• Customer phone is required</li>}
              {workItems.length === 0 && <li>• {isFromOrder ? 'Add pricing to work items' : 'At least one work item is required'}</li>}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
};

export default BillFormAdvanced;
