import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
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
  Product,
  ProductDescription,
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
import ProductDescriptionManager from '@/components/ProductDescriptionManager';

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
    billId: '', // Will be set asynchronously
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    orderId: '',
    items: [],
    products: [], // New field for Product + Description grouping
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
  
  // New Product + Description state
  const [products, setProducts] = useState<Product[]>([]);

  // Fetch data on mount
  useEffect(() => {
    // Initialize bill ID for new bills
    const initializeBillId = async () => {
      if (!bill && !formData.billId) {
        try {
          const newBillId = await generateBillId();
          setFormData(prev => ({
            ...prev,
            billId: newBillId,
            // Parse bill number correctly (remove any # prefix and parse as integer)
            billNumber: parseInt(newBillId.replace(/[^0-9]/g, ''))
          }));
        } catch (error) {
          console.error('Error generating bill ID:', error);
          // Fallback to timestamp-based ID
          const timestamp = Date.now().toString().slice(-6);
          setFormData(prev => ({
            ...prev,
            billId: `BILL${timestamp}`
          }));
        }
      }
    };

    initializeBillId();
  }, [bill, formData.billId]);

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
        },
        // Ensure payment records are properly initialized
        paymentRecords: bill.paymentRecords ? bill.paymentRecords.map(record => {
          let processedDate: Date;
          
          try {
            if (record.paymentDate instanceof Date) {
              processedDate = record.paymentDate;
            } else if (record.paymentDate && typeof record.paymentDate === 'object' && 'toDate' in record.paymentDate) {
              // Firebase Timestamp
              processedDate = record.paymentDate.toDate();
            } else if (record.paymentDate) {
              // String or other format
              processedDate = new Date(record.paymentDate);
            } else {
              processedDate = new Date();
            }
          } catch (error) {
            console.error('Error processing payment date:', error);
            processedDate = new Date();
          }
          
          return {
            ...record,
            paymentDate: processedDate
          };
        }) : [],
        // Ensure cash/online totals are properly calculated from payment records
        totalCashReceived: bill.totalCashReceived || (bill.paymentRecords ? bill.paymentRecords.reduce((sum, record) => {
          if (record.type === 'cash') return sum + record.amount;
          if (record.type === 'split') return sum + (record.cashAmount || 0);
          return sum;
        }, 0) : 0),
        totalOnlineReceived: bill.totalOnlineReceived || (bill.paymentRecords ? bill.paymentRecords.reduce((sum, record) => {
          if (record.type === 'online') return sum + record.amount;
          if (record.type === 'split') return sum + (record.onlineAmount || 0);
          return sum;
        }, 0) : 0),
        // Ensure paidAmount is properly set from payment records
        paidAmount: bill.paidAmount || (bill.paymentRecords ? bill.paymentRecords.reduce((sum, record) => sum + record.amount, 0) : 0),
        // Ensure balance is properly calculated
        balance: bill.balance || (bill.totalAmount || 0) - (bill.paidAmount || (bill.paymentRecords ? bill.paymentRecords.reduce((sum, record) => sum + record.amount, 0) : 0)),
        // Ensure status is properly set
        status: bill.status || calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || (bill.paymentRecords ? bill.paymentRecords.reduce((sum, record) => sum + record.amount, 0) : 0))
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
      
      // Initialize products from bill data (if exists) or convert from items
      if (bill.products && bill.products.length > 0) {
        setProducts(bill.products);
      } else if (bill.items && bill.items.length > 0) {
        // Convert existing items to the new product structure for backward compatibility
        const defaultProduct: Product = {
          id: uuidv4(),
          name: 'Services',
          total: bill.items.reduce((sum, item) => sum + item.amount, 0),
          descriptions: bill.items.map(item => ({
            id: item.id,
            description: item.description,
            qty: item.quantity,
            rate: item.rate,
            amount: item.amount
          })),
          expanded: true
        };
        setProducts([defaultProduct]);
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

  // Recalculate totals when enhanced bill items or products change
  useEffect(() => {
    // Use enhanced bill items if available, otherwise convert work items for backward compatibility
    let allItems: BillItem[] = enhancedBillItems.length > 0 ? enhancedBillItems : [
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

    // If using new product structure, convert products to items for calculation
    if (products.length > 0) {
      const productItems: BillItem[] = [];
      products.forEach(product => {
        product.descriptions.forEach(desc => {
          productItems.push({
            id: desc.id,
            type: 'service',
            description: desc.description,
            quantity: desc.qty,
            rate: desc.rate,
            cost: 0,
            amount: desc.amount
          });
        });
      });
      // Use product items if they exist, otherwise fall back to enhanced items
      if (productItems.length > 0) {
        allItems = productItems;
      }
    }

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
      // Auto-update QR amount to current balance unless manually overridden
      qrAmount: prev.qrAmount === 0 || prev.qrAmount === prev.balance ? Math.max(0, balance) : prev.qrAmount
    }));
  }, [enhancedBillItems, workItems, products, formData.gstPercent, formData.discount, formData.discountType, formData.paidAmount]);

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

  // REMOVED REDUNDANT useEffect - The first useEffect at line 327-389 already handles all calculations
  // This was causing the double-update bug where changes wouldn't apply on first save

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

  // Reference to the save function from ProductDescriptionManager
  const [productSaveFunction, setProductSaveFunction] = useState<(() => Promise<{newProductsArray: string[], newDescriptionsArray: string[]}>) | null>(null);

  // Function to receive the save function from ProductDescriptionManager
  const registerProductSaveFunction = (saveFunction: () => Promise<{newProductsArray: string[], newDescriptionsArray: string[]}>) => {
    setProductSaveFunction(() => saveFunction);
  };

  // Function to save new products and descriptions to Firestore
  const saveNewProductsAndDescriptions = async () => {
    try {
      if (productSaveFunction) {
        const result = await productSaveFunction();
        return result;
      }
    } catch (error) {
      console.error('Error saving new products and descriptions:', error);
      // Don't throw - this is not critical for bill saving
      toast({
        title: "Warning",
        description: "Bill saved but some new products/descriptions couldn't be saved for future use",
        variant: "default"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields with trimmed values
    const customerName = formData.customerName?.trim() || '';
    const customerPhone = formData.customerPhone?.trim() || '';
    
    if (!customerName) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive"
      });
      // Scroll to customer name field
      const customerNameField = document.querySelector('input[placeholder="Customer name"]') || 
                               document.querySelector('#customerName');
      if (customerNameField) {
        customerNameField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (customerNameField as HTMLElement).focus();
      }
      return;
    }
    
    if (!customerPhone) {
      toast({
        title: "Validation Error", 
        description: "Customer phone is required",
        variant: "destructive"
      });
      // Scroll to customer phone field
      const customerPhoneField = document.querySelector('input[placeholder="Customer phone"]');
      if (customerPhoneField) {
        customerPhoneField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (customerPhoneField as HTMLElement).focus();
      }
      return;
    }
    
    // Additional phone validation to ensure it's at least 10 digits
    const phoneDigits = customerPhone.replace(/\D/g, ''); // Remove non-digits
    if (phoneDigits.length < 10) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid phone number (at least 10 digits)",
        variant: "destructive"
      });
      const customerPhoneField = document.querySelector('input[placeholder="Customer phone"]');
      if (customerPhoneField) {
        customerPhoneField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (customerPhoneField as HTMLElement).focus();
      }
      return;
    }
    
    if (products.length === 0 && workItems.length === 0 && enhancedBillItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one product or work item is required",
        variant: "destructive"
      });
      return;
    }
    
    // Enhanced validation with visual feedback
    const itemsToValidate = enhancedBillItems.length > 0 ? enhancedBillItems : formData.items;
    const invalidItems = itemsToValidate.filter(item => 
      !item.description?.trim() || item.rate <= 0 || item.quantity <= 0
    );
    
    if (invalidItems.length > 0) {
      // Scroll to first invalid item and add visual feedback
      const firstInvalidId = invalidItems[0].id;
      const firstInvalidElement = document.getElementById(`item-${firstInvalidId}`) || 
                                  document.querySelector(`[data-item-id="${firstInvalidId}"]`);
      
      if (firstInvalidElement) {
        firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add red border to invalid fields
        const inputs = firstInvalidElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
          const element = input as HTMLElement;
          if (element.classList.contains('bg-white') || element.classList.contains('border-input')) {
            element.classList.add('border-red-500', 'border-2');
            element.style.borderColor = '#ef4444';
            
            // Remove red border after 3 seconds
            setTimeout(() => {
              element.classList.remove('border-red-500', 'border-2');
              element.style.borderColor = '';
            }, 3000);
          }
        });
      }
      
      toast({
        title: "Validation Error",
        description: "All items must have a description, positive rate, and quantity. Please check the highlighted fields.",
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
        billNumber: formData.billNumber, // Include billNumber field for proper sorting
        customerId: formData.customerId || selectedCustomer?.id || '',
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: formData.customerEmail?.trim() || '',
        customerAddress: formData.customerAddress?.trim() || '',
        orderId: formData.orderId || '',
        items: (formData.items || []).map(item => {
          const cleanItem: any = {
            id: item.id,
            type: item.type || 'service',
            description: item.description || '',
            quantity: item.quantity || 0,
            rate: item.rate || 0,
            cost: item.cost || 0,
            amount: item.amount || 0,
            isSubItem: item.isSubItem || false
          };
          
          // Only add optional fields if they have values
          if (item.sourceId) cleanItem.sourceId = item.sourceId;
          if (item.chargeType) cleanItem.chargeType = item.chargeType;
          if (item.materialName) cleanItem.materialName = item.materialName;
          if (item.materialCost) cleanItem.materialCost = item.materialCost;
          if (item.inventoryId) cleanItem.inventoryId = item.inventoryId;
          if (item.subItems && item.subItems.length > 0) cleanItem.subItems = item.subItems;
          if (item.parentId) cleanItem.parentId = item.parentId;
          
          return cleanItem;
        }).filter(item => item.description && item.quantity > 0), // Only include valid items
        products: products.length > 0 ? products : undefined, // Include products if they exist
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
        notes: formData.notes?.trim() || '',
        createdAt: bill?.createdAt || new Date(),
        updatedAt: new Date() // Always update the updatedAt timestamp
      };

      // Add optional payment fields only if they have valid values
      if (formData.paymentRecords && formData.paymentRecords.length > 0) {
        billData.paymentRecords = formData.paymentRecords;
      }
      if (typeof formData.totalCashReceived === 'number' && formData.totalCashReceived >= 0) {
        billData.totalCashReceived = formData.totalCashReceived;
      }
      if (typeof formData.totalOnlineReceived === 'number' && formData.totalOnlineReceived >= 0) {
        billData.totalOnlineReceived = formData.totalOnlineReceived;
      }

      // Sanitize bill data to remove any undefined values and ensure proper types
      const deepSanitize = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        
        // Handle Date objects specially
        if (obj instanceof Date) {
          return obj; // Keep Date objects as-is
        }
        
        if (Array.isArray(obj)) {
          return obj.map(deepSanitize).filter(item => item !== null && item !== undefined);
        }
        
        if (typeof obj === 'object' && obj.constructor === Object) {
          const sanitized: any = {};
          Object.keys(obj).forEach(key => {
            const value = obj[key];
            
            // Skip undefined and null values entirely
            if (value === undefined || value === null) {
              return;
            }
            
            // Handle special cases
            if (typeof value === 'number' && isNaN(value)) {
              sanitized[key] = 0;
              return;
            }
            
            if (typeof value === 'string') {
              const trimmed = value.trim ? value.trim() : value;
              if (trimmed !== '') {
                sanitized[key] = trimmed;
              }
              return;
            }
            
            // Handle booleans
            if (typeof value === 'boolean') {
              sanitized[key] = value;
              return;
            }
            
            // Handle numbers
            if (typeof value === 'number') {
              sanitized[key] = value;
              return;
            }
            
            // Recursively sanitize objects and arrays
            const sanitizedValue = deepSanitize(value);
            if (sanitizedValue !== null && sanitizedValue !== undefined) {
              sanitized[key] = sanitizedValue;
            }
          });
          return sanitized;
        }
        
        return obj;
      };
      
      let sanitizedBillData = deepSanitize(billData) as BillCreate;
      
      // Additional explicit cleanup for critical fields
      if (!sanitizedBillData) {
        throw new Error('Bill data sanitization failed');
      }

      // Additional validation to catch any potential issues before Firebase save
      const requiredFields = ['billId', 'customerName', 'customerPhone'];
      const missingFields = requiredFields.filter(field => !sanitizedBillData[field as keyof BillCreate]);
      
      if (missingFields.length > 0) {
        console.error('Missing required fields:', missingFields);
        toast({
          title: "Validation Error",
          description: `Missing required fields: ${missingFields.join(', ')}`,
          variant: "destructive"
        });
        return;
      }
      
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
      
      await onSave(sanitizedBillData);
      
      // Save new products and descriptions to Firestore
      await saveNewProductsAndDescriptions();
      
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
              <div className="space-y-4">
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
                
                {/* Editable customer details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <Label>Phone *</Label>
                    <Input
                      value={formData.customerPhone || ''}
                      onChange={(e) => {
                        // Only allow digits, spaces, hyphens, and plus sign
                        const value = e.target.value.replace(/[^0-9\s\-\+]/g, '');
                        setFormData(prev => ({ ...prev, customerPhone: value }));
                      }}
                      placeholder="Customer phone"
                      required
                      className={!formData.customerPhone?.trim() ? 'border-red-500' : ''}
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
                <div>
                  <Label>Email (Optional)</Label>
                  <Input value={formData.customerEmail || ''} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <Label>Address (Optional)</Label>
                  <Input value={formData.customerAddress || ''} readOnly className="bg-gray-50" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products & Services Section */}
        <ProductDescriptionManager
          products={products}
          onProductsChange={setProducts}
          onSaveNewEntries={registerProductSaveFunction}
        />

        {/* Legacy Work Section - Hidden when using products */}
        {products.length === 0 && (
          <BillWorkAndMaterials
            workItems={workItems}
            materialItems={materialItems}
            onWorkItemsChange={setWorkItems}
            onMaterialItemsChange={setMaterialItems}
            onBillItemsChange={setEnhancedBillItems}
            initialBillItems={enhancedBillItems}
          />
        )}

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
                  <NumberInput
                    value={formData.gstPercent === 0 ? null : formData.gstPercent}
                    onChange={(value) => setFormData(prev => ({ ...prev, gstPercent: value || 0 }))}
                    min={0}
                    max={30}
                    step={0.1}
                    allowEmpty={true}
                    emptyValue={0}
                    placeholder="Enter GST %"
                  />
                </div>
                <div>
                  <Label>Discount (₹)</Label>
                  <NumberInput
                    value={formData.discount === 0 ? null : formData.discount}
                    onChange={(value) => setFormData(prev => ({ ...prev, discount: value || 0 }))}
                    min={0}
                    step={0.01}
                    allowEmpty={true}
                    emptyValue={0}
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
            // Calculate new balance and status
            const newBalance = Math.max(0, (formData.totalAmount || 0) - paidAmount);
            const newStatus = calculateBillStatus(formData.totalAmount || 0, paidAmount);
            
            setFormData(prev => ({
              ...prev,
              paidAmount,
              paymentRecords,
              totalCashReceived: totalCash,
              totalOnlineReceived: totalOnline,
              balance: newBalance,
              status: newStatus,
              // Update QR amount to new balance if not manually overridden
              qrAmount: prev.qrAmount === prev.balance || !prev.qrAmount ? newBalance : prev.qrAmount
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
                <NumberInput
                  value={formData.qrAmount === 0 ? null : formData.qrAmount}
                  onChange={(value) => setFormData(prev => ({ ...prev, qrAmount: value || 0 }))}
                  min={0}
                  step={0.01}
                  allowEmpty={true}
                  emptyValue={0}
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
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 dark:from-green-700 dark:to-emerald-700 dark:hover:from-green-800 dark:hover:to-emerald-800"
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
            disabled={loading || !formData.customerName?.trim() || !formData.customerPhone?.trim() || (products.length === 0 && workItems.length === 0)}
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
        {(!formData.customerName?.trim() || !formData.customerPhone?.trim() || (products.length === 0 && workItems.length === 0)) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">
              {isFromOrder ? 'Please complete the bill details:' : 'Required fields missing:'}
            </h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              {!formData.customerName?.trim() && <li>• Customer name is required</li>}
              {!formData.customerPhone?.trim() && <li>• Customer phone is required</li>}
              {(products.length === 0 && workItems.length === 0) && <li>• {isFromOrder ? 'Add pricing to work items' : 'At least one product or work item is required'}</li>}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
};

export default BillFormAdvanced;
