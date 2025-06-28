
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
}

const MultipleOrderItemsSection: React.FC<MultipleOrderItemsSectionProps> = ({
  orderItems,
  setOrderItems,
  customerName,
  staff,
  materials
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
      deliveryDate: '',
      assignedStaff: [],
      requiredMaterials: [],
      designImages: [],
      notes: '',
      sizes: {}
    };
    console.log('Adding new item with category:', newItem.category);
    setOrderItems([...orderItems, newItem]);
  };

  const updateOrderItem = (index: number, field: string, value: any) => {
    const updatedItems = orderItems.map((item, i) => {
      if (i === index) {
        console.log(`Updating item ${index}, field: ${field}, value:`, value);
        
        // Handle the case where we're replacing the entire item
        if (field === 'completeItem') {
          return value;
        }
        
        // Handle normal field updates
        return { ...item, [field]: value };
      }
      return item;
    });
    setOrderItems(updatedItems);
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
            key={index}
            item={item}
            index={index}
            onUpdate={updateOrderItem}
            onRemove={removeOrderItem}
            canRemove={orderItems.length > 1}
            staff={staff}
            materials={materials}
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default MultipleOrderItemsSection;
