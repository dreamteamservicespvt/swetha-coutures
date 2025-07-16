
import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle, Edit3 } from 'lucide-react';
import { BillItem, BillBreakdown, BankDetails, calculateBillTotals, generateUPILink, generateQRCodeDataURL, Bill } from '@/utils/billingUtils';
import { getPaymentSettings } from '@/utils/settingsUtils';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface BillFormProps {
  billId?: string;
  bill?: Bill;
  onSave: (bill: Bill) => void;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

interface InventoryItem {
  id: string;
  itemName: string;
  stockQty: number;
  category?: string;
}

const BillForm = ({ billId, bill, onSave, onCancel, onSuccess }: BillFormProps) => {
  // Customer selection state
  const [isCustomerLocked, setIsCustomerLocked] = useState(!!bill);
  const [showChangeCustomer, setShowChangeCustomer] = useState(false);
  
  // Form state
  const [billIdState, setBillIdState] = useState(billId || bill?.billId || '');
  const [customerId, setCustomerId] = useState(bill?.customerId || '');
  const [customerName, setCustomerName] = useState(bill?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(bill?.customerPhone || '');
  const [customerEmail, setCustomerEmail] = useState<string | undefined>(bill?.customerEmail || '');
  const [customerAddress, setCustomerAddress] = useState<string | undefined>(bill?.customerAddress || '');
  const [orderId, setOrderId] = useState<string | undefined>(bill?.orderId || '');
  const [items, setItems] = useState<BillItem[]>(bill?.items || []);
  const [breakdown, setBreakdown] = useState<BillBreakdown>(bill?.breakdown || {
    fabric: 0,
    stitching: 0,
    accessories: 0,
    customization: 0,
    otherCharges: 0,
  });
  const [subtotal, setSubtotal] = useState(bill?.subtotal || 0);
  const [gstPercent, setGstPercent] = useState(bill?.gstPercent || 0);
  const [gstAmount, setGstAmount] = useState(bill?.gstAmount || 0);
  const [discount, setDiscount] = useState(bill?.discount || 0);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>(bill?.discountType || 'amount');
  const [totalAmount, setTotalAmount] = useState(bill?.totalAmount || 0);
  const [paidAmount, setPaidAmount] = useState(bill?.paidAmount || 0);
  const [balance, setBalance] = useState(bill?.balance || 0);
  const [status, setStatus] = useState<'paid' | 'partial' | 'unpaid'>(bill?.status || 'unpaid');
  const [date, setDate] = useState<Date | undefined>(bill?.date?.toDate?.() || new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(bill?.dueDate?.toDate?.() || undefined);
  const [bankDetails, setBankDetails] = useState<BankDetails>(bill?.bankDetails || {
    accountName: 'Swetha\'s Couture',
    accountNumber: '1234567890',
    ifsc: 'HDFC0001234',
    bankName: 'HDFC Bank',
  });
  const [upiId, setUpiId] = useState(bill?.upiId || '9849834102@ybl');
  const [upiLink, setUpiLink] = useState(bill?.upiLink || '');
  const [qrCodeUrl, setQrCodeUrl] = useState(bill?.qrCodeUrl || '');
  const [qrAmount, setQrAmount] = useState(bill?.balance || 0); // New QR amount field
  const [notes, setNotes] = useState<string | undefined>(bill?.notes || '');
  
  // Data collections
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // UI state
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemStock, setNewItemStock] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch data on mount
  useEffect(() => {
    fetchCustomers();
    fetchInventory();
    loadPaymentSettings(); // Load dynamic payment settings
  }, []);

  // Load dynamic payment settings from business settings
  const loadPaymentSettings = async () => {
    try {
      const paymentSettings = await getPaymentSettings();
      setBankDetails(paymentSettings.bankDetails);
      setUpiId(paymentSettings.upiId);
    } catch (error) {
      console.error('Error loading payment settings:', error);
      // Keep default values if loading fails
    }
  };

  // Set QR amount to balance when balance changes
  useEffect(() => {
    if (!bill || !billId) {
      setQrAmount(balance);
    }
  }, [balance, bill, billId]);

  const fetchCustomers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'customers'));
      const customerList: Customer[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        phone: doc.data().phone,
        email: doc.data().email,
        address: doc.data().address,
      }));
      setCustomers(customerList);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error Fetching Customers",
        description: "Failed to load customer data.",
        variant: "destructive",
      });
    }
  };

  const fetchInventory = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'inventory'));
      const inventoryList: InventoryItem[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        itemName: doc.data().itemName || doc.data().name,
        stockQty: doc.data().stockQty || doc.data().quantity || 0,
        category: doc.data().category,
      }));
      setInventory(inventoryList);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast({
        title: "Error Fetching Inventory",
        description: "Failed to load inventory data.",
        variant: "destructive",
      });
    }
  };

  // Customer selection logic
  useEffect(() => {
    if (customerId && !showChangeCustomer) {
      const selectedCustomer = customers.find(customer => customer.id === customerId);
      if (selectedCustomer) {
        setCustomerName(selectedCustomer.name);
        setCustomerPhone(selectedCustomer.phone);
        setCustomerEmail(selectedCustomer.email);
        setCustomerAddress(selectedCustomer.address);
      }
    }
  }, [customerId, customers, showChangeCustomer]);

  // Calculations
  useEffect(() => {
    const gstPercentValue = Number(gstPercent) || 0;
    const { subtotal: newSubtotal, gstAmount: newGstAmount, totalAmount: newTotalAmount } = calculateBillTotals(
      items, 
      breakdown, 
      gstPercentValue, 
      discount, 
      discountType
    );
    setSubtotal(newSubtotal);
    setGstAmount(gstPercentValue === 0 ? 0 : newGstAmount);
    setTotalAmount(newTotalAmount);
    setBalance(newTotalAmount - paidAmount);

    // Validation
    const errors: Record<string, string> = {};
    if (paidAmount > newTotalAmount) {
      errors.paidAmount = 'Paid amount cannot exceed total amount';
    }
    setValidationErrors(errors);
  }, [items, breakdown, gstPercent, discount, discountType, paidAmount]);

  // Status calculation
  useEffect(() => {
    setBalance(totalAmount - paidAmount);
    setStatus(
      paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'
    );
  }, [totalAmount, paidAmount]);

  // UPI and QR code generation
  const generateUpiLinkAndQrCode = useCallback(async () => {
    if (upiId && customerName && qrAmount && billIdState) {
      const newUpiLink = await generateUPILink(upiId, customerName, qrAmount, billIdState);
      setUpiLink(newUpiLink);
      try {
        const qrCodeDataURL = await generateQRCodeDataURL(newUpiLink);
        setQrCodeUrl(qrCodeDataURL);
      } catch (error) {
        console.error("Error generating QR code:", error);
        toast({
          title: "QR Code Generation Failed",
          description: "Could not generate QR code. Please check UPI ID and try again.",
          variant: "destructive",
        });
        setQrCodeUrl('');
      }
    } else {
      setUpiLink('');
      setQrCodeUrl('');
    }
  }, [upiId, customerName, qrAmount, billIdState]);

  useEffect(() => {
    generateUpiLinkAndQrCode();
  }, [generateUpiLinkAndQrCode]);

  // Item management
  const addItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
      chargeType: '',
      type: 'service',
      cost: 0
    }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: string, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item };
        if (field === 'quantity' || field === 'rate') {
          const numericValue = Number(value);
          updatedItem[field] = numericValue;
          updatedItem.amount = updatedItem.quantity * updatedItem.rate;
        } else {
          updatedItem[field] = value;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const updateBreakdown = (chargeType: keyof BillBreakdown, value: number) => {
    setBreakdown(prev => ({ ...prev, [chargeType]: value }));
  };

  // Add new inventory item
  const handleAddNewItem = async () => {
    try {
      const newItem = {
        itemName: newItemName,
        category: newItemCategory,
        stockQty: newItemStock,
        createdAt: new Date(),
      };
      
      const docRef = await addDoc(collection(db, 'inventory'), newItem);
      
      setInventory(prev => [...prev, { id: docRef.id, ...newItem }]);
      
      // Reset form
      setNewItemName('');
      setNewItemCategory('');
      setNewItemStock(0);
      setShowNewItemModal(false);
      
      toast({
        title: "Item Added",
        description: `${newItemName} has been added to inventory.`,
      });
    } catch (error) {
      console.error('Error adding new item:', error);
      toast({
        title: "Error",
        description: "Failed to add new item to inventory.",
        variant: "destructive",
      });
    }
  };

  // Get stock warning for item
  const getStockWarning = (description: string, quantity: number) => {
    const inventoryItem = inventory.find(item => 
      item.itemName.toLowerCase() === description.toLowerCase()
    );
    
    if (inventoryItem && inventoryItem.stockQty < quantity) {
      return `Warning: Only ${inventoryItem.stockQty} left in stock.`;
    }
    return null;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (Object.keys(validationErrors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving.",
        variant: "destructive",
      });
      return;
    }

    // Final calculations with proper GST handling
    const finalGstPercent = Number(gstPercent) || 0;
    const { subtotal: finalSubtotal, gstAmount: finalGstAmount, totalAmount: finalTotalAmount } = calculateBillTotals(
      items.filter(item => item.description.trim()),
      breakdown,
      finalGstPercent,
      discount,
      discountType
    );

    const billData: Bill = {
      id: billId || bill?.id || uuidv4(),
      billId: billIdState,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      orderId,
      items: items.filter(item => item.description.trim()),
      breakdown,
      subtotal: finalSubtotal,
      gstPercent: finalGstPercent,
      gstAmount: finalGstPercent === 0 ? 0 : finalGstAmount,
      discount,
      discountType,
      totalAmount: finalTotalAmount,
      paidAmount,
      balance: finalTotalAmount - paidAmount,
      status: paidAmount >= finalTotalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
      date,
      dueDate,
      bankDetails,
      upiId,
      upiLink,
      qrCodeUrl,
      notes,
      createdAt: bill?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    onSave(billData);
    
    toast({
      title: "Success",
      description: `Bill ${billIdState} ${bill ? 'updated' : 'created'} successfully.`,
    });
    
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-3 sm:p-6 bg-white rounded-lg shadow-lg">
      {/* Header Section */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          {billId || bill ? 'Edit Bill' : 'Create New Bill'}
        </h2>
        <p className="text-sm sm:text-base text-gray-600">
          Manage your billing details and customer information here.
        </p>
        
        {/* Customer Lock Info */}
        {isCustomerLocked && bill && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 mb-2">
              You are editing Bill #{bill.billId}. To change customer, click 'Change Customer'.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowChangeCustomer(!showChangeCustomer)}
              className="text-blue-600"
            >
              <Edit3 className="h-4 w-4 mr-1" />
              Change Customer
            </Button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Customer and Order Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-4">
            <Label htmlFor="customer" className="text-sm sm:text-base">Select Customer *</Label>
            {isCustomerLocked && !showChangeCustomer ? (
              <div className="space-y-2">
                <Input value={customerName} readOnly className="bg-gray-100" />
                <Input value={customerPhone} readOnly className="bg-gray-100 text-sm" />
                {customerEmail && <Input value={customerEmail} readOnly className="bg-gray-100 text-sm" />}
              </div>
            ) : (
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="orderId" className="text-sm sm:text-base">Order ID (Optional)</Label>
            <Input
              id="orderId"
              type="text"
              placeholder="Enter order ID"
              value={orderId || ''}
              onChange={(e) => setOrderId(e.target.value)}
            />
          </div>
        </div>

        {/* Items Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Bill Items</h3>
            <Button
              type="button"
              onClick={addItem}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>

          {/* Items List - Responsive */}
          <div className="space-y-4">
            {items.map((item, index) => {
              const stockWarning = getStockWarning(item.description, item.quantity);
              return (
                <div key={item.id} className="border rounded-lg p-4 space-y-4 bg-gray-50">
                  {/* Mobile Layout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-2">
                      <Label className="text-sm">Description</Label>
                      <Select 
                        value={item.description} 
                        onValueChange={(value) => updateItem(item.id, 'description', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory.map(invItem => (
                            <SelectItem key={invItem.id} value={invItem.itemName}>
                              {invItem.itemName} | Stock: {invItem.stockQty}
                            </SelectItem>
                          ))}
                          <SelectItem value="__add_new__">
                            <span className="text-blue-600">+ Add New Item</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {stockWarning && (
                        <Badge variant="destructive" className="mt-1 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {stockWarning}
                        </Badge>
                      )}
                    </div>
                    
                    <div>
                      <Label className="text-sm">Qty</Label>
                      <NumberInput
                        value={item.quantity}
                        onChange={(value) => updateItem(item.id, 'quantity', value?.toString() || '1')}
                        min={0.1}
                        step={0.1}
                        decimals={1}
                        allowEmpty={false}
                        emptyValue={1}
                        placeholder="1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm">Rate per unit (₹)</Label>
                      <NumberInput
                        value={item.rate}
                        onChange={(value) => updateItem(item.id, 'rate', value?.toString() || '0')}
                        min={0}
                        step={0.01}
                        allowEmpty={false}
                        emptyValue={0}
                        placeholder="Enter rate per unit"
                      />
                    </div>
                    
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-sm">Amount</Label>
                        <NumberInput
                          value={item.amount}
                          readOnly
                          className="bg-white font-medium text-purple-600"
                        />
                        {/* Show calculation breakdown for clarity */}
                        {item.quantity > 0 && item.rate > 0 && (
                          <div className="text-xs text-gray-600 mt-1">
                            {item.quantity} × ₹{item.rate} = ₹{(item.quantity * item.rate).toFixed(2)}
                          </div>
                        )}
                      </div>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:bg-red-50 p-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calculations and Payment Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calculations */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Calculations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">GST (%)</Label>
                <NumberInput
                  value={gstPercent}
                  onChange={(value) => setGstPercent(value || 0)}
                  min={0}
                  max={100}
                  step={0.01}
                  allowEmpty={false}
                  emptyValue={0}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Discount Type</Label>
                <Select value={discountType} onValueChange={(value: 'amount' | 'percentage') => setDiscountType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">Amount (₹)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Discount {discountType === 'percentage' ? '(%)' : '(₹)'}</Label>
                <NumberInput
                  value={discount}
                  onChange={(value) => setDiscount(value || 0)}
                  min={0}
                  step={0.01}
                  allowEmpty={false}
                  emptyValue={0}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Paid Amount</Label>
                <NumberInput
                  value={paidAmount}
                  onChange={(value) => setPaidAmount(value || 0)}
                  min={0}
                  step={0.01}
                  allowEmpty={false}
                  emptyValue={0}
                  placeholder="0.00"
                  className={validationErrors.paidAmount ? 'border-red-500' : ''}
                />
                {validationErrors.paidAmount && (
                  <p className="text-red-500 text-xs">{validationErrors.paidAmount}</p>
                )}
              </div>
            </div>
          </div>

          {/* Summary and QR Payment */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Bill Summary</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST ({gstPercent}%):</span>
                <span>₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Discount:</span>
                <span>-₹{discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total Amount:</span>
                <span className="text-purple-600">₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Paid Amount:</span>
                <span className="text-green-600">₹{paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Balance:</span>
                <span className={balance > 0 ? 'text-red-600' : 'text-green-600'}>
                  ₹{balance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* QR Payment Section */}
            <div className="space-y-3">
              <Label className="text-sm">QR Amount (for payment)</Label>
              <div className="flex gap-2">
                <NumberInput
                  value={qrAmount}
                  onChange={(value) => setQrAmount(value || 0)}
                  min={0}
                  step={0.01}
                  allowEmpty={false}
                  emptyValue={0}
                  placeholder="0.00"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateUpiLinkAndQrCode}
                  size="sm"
                >
                  Regenerate QR
                </Button>
              </div>
              <p className="text-xs text-gray-600">
                Amount encoded in QR: ₹{qrAmount.toFixed(2)}. Edit if you need a partial-payment QR.
              </p>
              
              {qrCodeUrl && (
                <div className="text-center">
                  <img src={qrCodeUrl} alt="UPI QR Code" className="w-32 h-32 mx-auto border rounded" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Date</Label>
            <DatePicker date={date} onDateChange={setDate} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Due Date</Label>
            <DatePicker date={dueDate} onDateChange={setDueDate} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">UPI ID</Label>
          <Input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="your-upi@bank"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Notes (Optional)</Label>
          <Input
            value={notes || ''}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
          />
        </div>

        {/* Sticky Action Bar for Mobile */}
        <div className="sticky bottom-0 bg-white border-t pt-4 mt-6 sm:static sm:border-t-0 sm:pt-0">
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="order-1 sm:order-2 bg-purple-600 hover:bg-purple-700"
              disabled={Object.keys(validationErrors).length > 0}
            >
              Save Bill
            </Button>
          </div>
        </div>
      </form>

      {/* Add New Item Modal */}
      <Dialog open={showNewItemModal} onOpenChange={setShowNewItemModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Enter item name"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                placeholder="Enter category"
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Stock</Label>
              <NumberInput
                value={newItemStock}
                onChange={(value) => setNewItemStock(value || 0)}
                min={0}
                allowEmpty={false}
                emptyValue={0}
                placeholder="Enter initial stock"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowNewItemModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNewItem}>
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillForm;
