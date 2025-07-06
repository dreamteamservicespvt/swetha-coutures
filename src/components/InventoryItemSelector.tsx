
import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Plus } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface InventoryItem {
  id: string;
  itemName: string;
  name?: string; // Some items might use name instead of itemName
  stockQty: number;
  quantity?: number; // Some items might use quantity instead of stockQty
  category?: string;
  unitPrice?: number;
  costPerUnit?: number; // Some items use costPerUnit instead of unitPrice
}

interface InventoryItemSelectorProps {
  inventory: InventoryItem[];
  value: string;
  onValueChange: (value: string) => void;
  onInventoryUpdate: () => void;
  quantity?: number;
}

const InventoryItemSelector = ({ 
  inventory, 
  value, 
  onValueChange, 
  onInventoryUpdate,
  quantity = 1 
}: InventoryItemSelectorProps) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemStock, setNewItemStock] = useState(0);
  const [newItemPrice, setNewItemPrice] = useState(0);

  const selectedItem = inventory.find(item => item.itemName === value);
  const isLowStock = selectedItem && selectedItem.stockQty < quantity;

  const handleAddNewItem = async () => {
    try {
      const newItem = {
        itemName: newItemName,
        category: newItemCategory,
        stockQty: newItemStock,
        unitPrice: newItemPrice, 
        costPerUnit: newItemPrice, // For compatibility with existing inventory
        createdAt: new Date(),
      };
      
      await addDoc(collection(db, 'inventory'), newItem);
      
      // Reset form
      setNewItemName('');
      setNewItemCategory('');
      setNewItemStock(0);
      setNewItemPrice(0);
      setShowAddModal(false);
      
      // Update inventory list
      onInventoryUpdate();
      
      // Select the new item
      onValueChange(newItemName);
      
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

  return (
    <div className="space-y-2">
      <Select value={value || ""} onValueChange={(selectedValue) => {
        if (selectedValue === '__add_new__') {
          setShowAddModal(true);
        } else {
          onValueChange(selectedValue);
        }
      }}>
        <SelectTrigger>
          <SelectValue placeholder="Select item from inventory">
            {value ? (
              <div className="flex items-center justify-between w-full">
                <span>{value}</span>
                {selectedItem && (
                  <div className="flex items-center gap-2">
                    {(selectedItem.unitPrice > 0 || selectedItem.costPerUnit > 0) && (
                      <Badge variant="outline" className="text-xs">
                        ₹{selectedItem.unitPrice || selectedItem.costPerUnit}
                      </Badge>
                    )}
                    <Badge variant={selectedItem.stockQty < 10 ? "destructive" : "secondary"} className="text-xs">
                      Stock: {selectedItem.stockQty || 0}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              "Select item from inventory"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {inventory && inventory.length > 0 ? (
            inventory.map(item => (
              <SelectItem key={`item-${item.id}`} value={item.itemName}>
                <div className="flex items-center justify-between w-full">
                  <span>{item.itemName || "Unnamed Item"}</span>
                  <div className="flex items-center gap-2">
                    {(item.unitPrice > 0 || item.costPerUnit > 0) && (
                      <Badge variant="outline" className="text-xs">
                        ₹{item.unitPrice || item.costPerUnit}
                      </Badge>
                    )}
                    <Badge variant={item.stockQty < 10 ? "destructive" : "secondary"} className="ml-2">
                      Stock: {item.stockQty || 0}
                    </Badge>
                  </div>
                </div>
              </SelectItem>
            ))
          ) : (
            <SelectItem value="no_items" disabled>No inventory items available</SelectItem>
          )}
          <SelectItem value="__add_new__" className="text-blue-600">
            <div className="flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Add New Item
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      
      {isLowStock && (
        <Badge variant="destructive" className="w-full justify-center">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Warning: Only {selectedItem.stockQty} left in stock
        </Badge>
      )}

      {/* Add New Item Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
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
                placeholder="Enter category (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Price per Unit (₹)</Label>
              <NumberInput
                value={newItemPrice}
                onChange={(value) => setNewItemPrice(value || 0)}
                min={0}
                step={0.01}
                decimals={2}
                allowEmpty={false}
                emptyValue={0}
                placeholder="Enter price per unit"
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Stock *</Label>
              <NumberInput
                value={newItemStock}
                onChange={(value) => setNewItemStock(value || 0)}
                min={0}
                allowEmpty={false}
                emptyValue={0}
                placeholder="Enter initial stock quantity"
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddNewItem}
                disabled={!newItemName.trim() || newItemStock < 0}
              >
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryItemSelector;
