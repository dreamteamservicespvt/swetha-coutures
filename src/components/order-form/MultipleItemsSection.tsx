
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { NumberInput } from '@/components/ui/number-input';
import { Trash2, Plus, Package } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OrderItem {
  category: string;
  description: string;
  price: number;
  quantity: number;
  assignedPerson: string;
}

interface MultipleItemsSectionProps {
  useMultipleItems: boolean;
  setUseMultipleItems: (value: boolean) => void;
  orderItems: OrderItem[];
  setOrderItems: (items: OrderItem[]) => void;
  customerName: string;
}

const MultipleItemsSection: React.FC<MultipleItemsSectionProps> = ({
  useMultipleItems,
  setUseMultipleItems,
  orderItems,
  setOrderItems,
  customerName
}) => {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set([0]));

  const categories = [
    'Lehenga', 'Saree Blouse', 'Salwar Kameez', 'Kurti', 'Gown', 'Dress',
    'Shirt', 'Pants', 'Skirt', 'Jacket', 'Suit', 'Other'
  ];

  const addNewItem = () => {
    const newItem: OrderItem = {
      category: '',
      description: '',
      price: 0,
      quantity: 1,
      assignedPerson: customerName || ''
    };
    setOrderItems([...orderItems, newItem]);
    setOpenItems(prev => new Set([...prev, orderItems.length]));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const updatedItems = orderItems.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setOrderItems(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(updatedItems);
    setOpenItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const toggleItem = (index: number) => {
    setOpenItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getTotalAmount = () => {
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getTotalQuantity = () => {
    return orderItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  // Initialize with one item if switching to multiple items mode
  React.useEffect(() => {
    if (useMultipleItems && orderItems.length === 0) {
      addNewItem();
    }
  }, [useMultipleItems]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Order Items
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Label htmlFor="multiple-items">Multiple Items</Label>
            <Switch
              id="multiple-items"
              checked={useMultipleItems}
              onCheckedChange={setUseMultipleItems}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {useMultipleItems ? (
          <div className="space-y-4">
            {orderItems.map((item, index) => (
              <Collapsible 
                key={index}
                open={openItems.has(index)}
                onOpenChange={() => toggleItem(index)}
              >
                <Card className="border-l-4 border-l-blue-500">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 pb-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Item {index + 1}</span>
                          {item.category && (
                            <span className="text-sm text-gray-500">- {item.category}</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {item.price > 0 && (
                            <span className="text-sm font-medium">₹{(item.price * item.quantity).toLocaleString()}</span>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(index);
                            }}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Category *</Label>
                          <Select
                            value={item.category}
                            onValueChange={(value) => updateItem(index, 'category', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Assigned Person</Label>
                          <Input
                            value={item.assignedPerson}
                            onChange={(e) => updateItem(index, 'assignedPerson', e.target.value)}
                            placeholder="Person responsible"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label>Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Item description"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Price (₹) *</Label>
                          <NumberInput
                            value={item.price}
                            onChange={(value) => updateItem(index, 'price', value || 0)}
                            min={0}
                            step={0.01}
                            decimals={2}
                            allowEmpty={false}
                            emptyValue={0}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Quantity *</Label>
                          <NumberInput
                            value={item.quantity}
                            onChange={(value) => updateItem(index, 'quantity', value || 1)}
                            min={1}
                            allowEmpty={false}
                            emptyValue={1}
                            placeholder="1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
            
            <div className="flex justify-between items-center pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={addNewItem}
                className="flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
              
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  Total Quantity: {getTotalQuantity()}
                </div>
                <div className="text-lg font-semibold">
                  Total Amount: ₹{getTotalAmount().toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <p>Enable "Multiple Items" to add multiple items to this order</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MultipleItemsSection;
