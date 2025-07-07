import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { collection, addDoc, getDocs, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import CustomerInfoSection from '@/components/order-form/CustomerInfoSection';
import MultipleOrderItemsSection from '@/components/order-form/MultipleOrderItemsSection';
import { OrderFormData, OrderItem, Staff, Material } from '@/types/orderTypes';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingOrder?: any;
}

const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ isOpen, onClose, onSuccess, editingOrder }) => {
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<OrderFormData>();

  const customerNameValue = watch('customerName');

  useEffect(() => {
    if (isOpen) {
      fetchData();
      if (editingOrder) {
        populateEditForm();
      } else {
        resetForm();
      }
    }
  }, [isOpen, editingOrder]);

  useEffect(() => {
    if (customerNameValue && customerNameValue.length > 1) {
      setShowCustomerSuggestions(true);
    } else {
      setShowCustomerSuggestions(false);
    }
  }, [customerNameValue]);

  // Auto-populate "Made For" field when customer name changes
  useEffect(() => {
    if (customerNameValue && customerNameValue.trim()) {
      const updatedItems = orderItems.map((item, index) => ({
        ...item,
        madeFor: customerNameValue // Always update all items, including first item
      }));
      setOrderItems(updatedItems);
    }
  }, [customerNameValue]);

  const populateEditForm = () => {
    if (!editingOrder) return;

    setValue('customerName', editingOrder.customerName || '');
    setValue('customerPhone', editingOrder.customerPhone || '');
    setValue('customerEmail', editingOrder.customerEmail || '');

    if (editingOrder.items && editingOrder.items.length > 0) {
      // Convert items to new structure
      const convertedItems = editingOrder.items.map((item: any) => ({
        madeFor: item.madeFor || editingOrder.customerName || '',
        category: item.category || '',
        description: item.description || '',
        quantity: item.quantity || 1,
        status: item.status || 'received',
        orderDate: item.orderDate || new Date().toISOString().split('T')[0],
        deliveryDate: item.deliveryDate || '',
        assignedStaff: item.assignedStaff || [],
        requiredMaterials: item.requiredMaterials || [],
        designImages: item.designImages || [],
        notes: item.notes || '',
        sizes: item.sizes || {}
      }));
      setOrderItems(convertedItems);
    } else {
      // Convert single order to item format for backward compatibility
      const singleItem: OrderItem = {
        madeFor: editingOrder.customerName || '',
        category: editingOrder.itemType || '',
        description: '',
        quantity: editingOrder.quantity || 1,
        status: editingOrder.status || 'received',
        orderDate: editingOrder.orderDate || new Date().toISOString().split('T')[0],
        deliveryDate: editingOrder.deliveryDate || '',
        assignedStaff: editingOrder.assignedStaff || [],
        requiredMaterials: editingOrder.requiredMaterials || [],
        designImages: editingOrder.designImages || [],
        notes: editingOrder.notes || '',
        sizes: editingOrder.sizes || {}
      };
      setOrderItems([singleItem]);
    }
  };

  // Customer selection handler for auto-fill
  const handleCustomerSelect = (customer: any) => {
    // Auto-fill basic customer info is already handled by CustomerInfoSection
    // Here we could add additional logic for auto-filling sizes if needed
    console.log('Customer selected:', customer.name);
  };

  const resetForm = () => {
    reset();
    const newItem: OrderItem = {
      madeFor: customerNameValue || '',
      category: '',
      description: '',
      quantity: 1,
      status: 'received',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: '',
      assignedStaff: [],
      requiredMaterials: [],
      designImages: [],
      notes: '',
      sizes: {}
    };
    setOrderItems([newItem]);
  };

  const fetchData = async () => {
    try {
      // Fetch staff with active orders count
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      
      const staffData = staffSnapshot.docs.map(doc => {
        const data = doc.data();
        const activeOrdersCount = ordersSnapshot.docs.filter(orderDoc => {
          const orderData = orderDoc.data();
          return orderData.assignedStaff?.includes(doc.id) && 
                 orderData.status !== 'delivered' && 
                 orderData.status !== 'cancelled';
        }).length;
        
        return {
          id: doc.id,
          ...data,
          activeOrdersCount
        };
      }) as Staff[];
      setStaff(staffData);

      // Fetch materials/inventory
      const materialsSnapshot = await getDocs(collection(db, 'inventory'));
      const materialsData = materialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Material[];
      setMaterials(materialsData);

      // Fetch customers
      const customersSnapshot = await getDocs(collection(db, 'customers'));
      const customersData = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load form data",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: OrderFormData) => {
    if (orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the order",
        variant: "destructive",
      });
      return;
    }

    // Validate each item
    for (let i = 0; i < orderItems.length; i++) {
      const item = orderItems[i];
      if (!item.madeFor || !item.category || !item.deliveryDate) {
        toast({
          title: "Error",
          description: `Please complete all required fields for item ${i + 1}`,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);

      // Find existing customer to get customerId
      const existingCustomer = customers.find(c => 
        c.name.toLowerCase() === data.customerName.toLowerCase()
      );

      const baseOrderData = {
        orderId: editingOrder?.orderNumber || `ORD-${Date.now().toString().slice(-6)}`,
        orderNumber: editingOrder?.orderNumber || `ORD-${Date.now().toString().slice(-6)}`,
        customerId: existingCustomer?.id || null,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || '',
        items: orderItems,
        itemType: orderItems.length === 1 ? orderItems[0].category : 'Multiple Items',
        quantity: totalQuantity,
        status: orderItems[0]?.status || 'received',
        orderDate: orderItems[0]?.orderDate || new Date().toISOString().split('T')[0],
        deliveryDate: orderItems[0]?.deliveryDate || '',
        notes: orderItems.map(item => item.notes).filter(Boolean).join('\n'),
        assignedStaff: [...new Set(orderItems.flatMap(item => item.assignedStaff))],
        requiredMaterials: [...new Set(orderItems.flatMap(item => item.requiredMaterials.map(m => m.id)))],
        designImages: [...new Set(orderItems.flatMap(item => item.designImages))],
        updatedAt: serverTimestamp(),
        measurements: editingOrder?.measurements || {},
        progress: editingOrder?.progress || {
          cutting: false,
          stitching: false,
          finishing: false
        },
        priority: editingOrder?.priority || 'normal'
      };

      if (editingOrder) {
        // Update existing order
        await updateDoc(doc(db, 'orders', editingOrder.id), baseOrderData);
        toast({
          title: "Success",
          description: "Order updated successfully",
        });
      } else {
        // Create new order
        const newOrderData = {
          ...baseOrderData,
          createdAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'orders'), newOrderData);

        // Create customer if not exists or update existing customer with measurements
        const existingCustomer = customers.find(c => 
          c.name.toLowerCase() === data.customerName.toLowerCase()
        );
        
        // Collect all measurements from order items
        const allMeasurements: Record<string, any> = {};
        orderItems.forEach((item, index) => {
          if (item.sizes && Object.keys(item.sizes).length > 0) {
            allMeasurements[`${item.category || `item_${index + 1}`}`] = {
              madeFor: item.madeFor,
              sizes: item.sizes,
              category: item.category
            };
          }
        });

        if (!existingCustomer) {
          // Create new customer with comprehensive info
          await addDoc(collection(db, 'customers'), {
            name: data.customerName,
            phone: data.customerPhone,
            email: data.customerEmail || '',
            address: '', // Can be added later
            measurements: allMeasurements,
            orderHistory: [docRef.id],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          // Update existing customer with new measurements and order
          const updatedMeasurements = {
            ...existingCustomer.measurements,
            ...allMeasurements
          };
          
          await updateDoc(doc(db, 'customers', existingCustomer.id), {
            phone: data.customerPhone, // Update phone if changed
            email: data.customerEmail || existingCustomer.email,
            measurements: updatedMeasurements,
            orderHistory: [...(existingCustomer.orderHistory || existingCustomer.orders || []), docRef.id],
            updatedAt: serverTimestamp()
          });
        }

        // Update inventory quantities for selected materials
        const allMaterials = orderItems.flatMap(item => item.requiredMaterials);
        for (const material of allMaterials) {
          const inventoryItem = materials.find(m => m.id === material.id);
          if (inventoryItem && inventoryItem.quantity >= material.quantity) {
            await updateDoc(doc(db, 'inventory', material.id), {
              quantity: inventoryItem.quantity - material.quantity,
              updatedAt: serverTimestamp()
            });
          }
        }

        toast({
          title: "Success",
          description: `Order created successfully with ${orderItems.length} item${orderItems.length > 1 ? 's' : ''}`,
        });
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving order:', error);
      toast({
        title: "Error",
        description: editingOrder ? "Failed to update order" : "Failed to create order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingOrder ? 'Edit Order' : 'Create New Order'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Customer Information */}
          <CustomerInfoSection
            register={register}
            errors={errors}
            setValue={setValue}
            customerNameValue={customerNameValue}
            customers={customers}
            showCustomerSuggestions={showCustomerSuggestions}
            setShowCustomerSuggestions={setShowCustomerSuggestions}
            onCustomerSelect={handleCustomerSelect}
          />

          {/* Multiple Order Items */}
          <MultipleOrderItemsSection
            orderItems={orderItems}
            setOrderItems={setOrderItems}
            customerName={customerNameValue}
            staff={staff}
            materials={materials}
            orderId={editingOrder?.id}
          />

          {/* Footer Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || orderItems.length === 0}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              {loading ? (editingOrder ? 'Updating...' : 'Creating...') : (editingOrder ? 'Update Order' : 'Create Order')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderModal;
