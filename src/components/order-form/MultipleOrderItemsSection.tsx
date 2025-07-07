import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Package2 } from 'lucide-react';
import OrderItemCard from './OrderItemCard';
import { OrderItem, Staff, Material } from '@/types/orderTypes';

interface MultipleOrderItemsSectionProps {
  orderItems: OrderItem[];
  setOrderItems: (items: OrderItem[]) => void;
  customerName: string;
  staff: Staff[];
  materials: Material[];
  orderId?: string; // Optional orderId for existing orders
}

const MultipleOrderItemsSection: React.FC<MultipleOrderItemsSectionProps> = ({
  orderItems,
  setOrderItems,
  customerName,
  staff,
  materials,
  orderId
}) => {
  const addOrderItem = () => {
    // Initialize a new item with explicitly set category as an empty string
    const newItem: OrderItem = {
      madeFor: customerName || '',
      category: '',  // Explicitly initialize category
      description: '',
      quantity: 1,
      status: 'received',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: orderItems.length > 0 ? orderItems[0].deliveryDate : '', // Auto-sync delivery date from Item 1
      assignedStaff: [],
      requiredMaterials: [],
      designImages: [],
      notes: '',
      sizes: {}
    };
    setOrderItems([...orderItems, newItem]);
  };

  const updateOrderItem = (index: number, field: string, value: any) => {
    const updatedItems = orderItems.map((item, i) => {
      if (i === index) {
        // Handle the case where we're replacing the entire item
        if (field === 'completeItem') {
          return value;
        }
        
        // Handle normal field updates
        const updatedItem = { ...item, [field]: value };
        return updatedItem;
      }
      return item;
    });
    
    setOrderItems(updatedItems);
  };

  // Handle delivery date sync from Item 1 to all subsequent items
  const handleDeliveryDateSync = (sourceIndex: number, date: string) => {
    if (sourceIndex === 0 && date.trim() !== '') { // Only sync from Item 1 and only if there's a valid date
      const updatedItems = orderItems.map((item, i) => {
        if (i > 0) { // Apply to Item 2 and beyond
          return { ...item, deliveryDate: date };
        }
        return item;
      });
      // Only update if there's an actual change to prevent unnecessary rerenders
      const hasChanges = updatedItems.some(
        (updatedItem, idx) => 
          idx > 0 && 
          updatedItem.deliveryDate !== orderItems[idx].deliveryDate
      );
      
      if (hasChanges) {
        setOrderItems(updatedItems);
      }
    }
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      const updatedItems = orderItems.filter((_, i) => i !== index);
      setOrderItems(updatedItems);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <Package2 className="h-5 w-5 mr-2" />
          Order Items ({orderItems.length})
        </CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOrderItem}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Item</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {orderItems.map((item, index) => (
          <OrderItemCard
            key={`order-item-${index}`}
            item={item}
            index={index}
            onUpdate={updateOrderItem}
            onRemove={removeOrderItem}
            canRemove={orderItems.length > 1}
            staff={staff}
            materials={materials}
            customerName={customerName}
            orderId={orderId}
            onDeliveryDateChange={handleDeliveryDateSync}
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default MultipleOrderItemsSection;
