
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Minus, Package2 } from 'lucide-react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  quantity: number;
  unit: string;
}

interface RequiredMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface RequiredMaterialsProps {
  selectedMaterials: RequiredMaterial[];
  onChange: (materials: RequiredMaterial[]) => void;
}

const RequiredMaterials: React.FC<RequiredMaterialsProps> = ({
  selectedMaterials,
  onChange
}) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [addMaterialDialogOpen, setAddMaterialDialogOpen] = useState(false);

  // Debounced update function to prevent rapid-fire changes
  const debouncedOnChange = useCallback(
    debounce((materials: RequiredMaterial[]) => {
      onChange(materials);
    }, 300),
    [onChange]
  );

  // Debounce utility function
  function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    }) as T;
  }

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const inventorySnapshot = await getDocs(collection(db, 'inventory'));
      const inventoryData = inventorySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      setInventory(inventoryData);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialToggle = (item: InventoryItem, checked: boolean) => {
    if (checked) {
      const newMaterial: RequiredMaterial = {
        id: item.id,
        name: item.name,
        quantity: 1,
        unit: item.unit
      };
      // Use immediate onChange for adding/removing materials
      onChange([...selectedMaterials, newMaterial]);
    } else {
      // Use immediate onChange for adding/removing materials
      onChange(selectedMaterials.filter(m => m.id !== item.id));
    }
  };

  const updateMaterialQuantity = (materialId: string, quantity: number) => {
    if (quantity <= 0) {
      // Use immediate onChange for removing materials
      onChange(selectedMaterials.filter(m => m.id !== materialId));
      return;
    }
    
    // Use debounced onChange for quantity updates to prevent rapid firing
    const updatedMaterials = selectedMaterials.map(m => 
      m.id === materialId ? { ...m, quantity } : m
    );
    debouncedOnChange(updatedMaterials);
  };

  const addNewMaterial = async () => {
    if (!newMaterialName.trim()) return;
    
    setIsAddingMaterial(true);
    try {
      const newMaterial = {
        name: newMaterialName,
        type: 'Custom Material',
        quantity: 0,
        unit: 'pcs',
        minStock: 5,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'inventory'), newMaterial);
      
      const materialToAdd: RequiredMaterial = {
        id: docRef.id,
        name: newMaterialName,
        quantity: 1,
        unit: 'pcs'
      };
      
      onChange([...selectedMaterials, materialToAdd]);
      setNewMaterialName('');
      setAddMaterialDialogOpen(false);
      fetchInventory(); // Refresh inventory list
      
      toast({
        title: "Success",
        description: "New material added to inventory and selected",
      });
    } catch (error) {
      console.error('Error adding material:', error);
      toast({
        title: "Error",
        description: "Failed to add new material",
        variant: "destructive",
      });
    } finally {
      setIsAddingMaterial(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Required Materials</Label>
        <div className="text-sm text-gray-500">Loading materials...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="flex items-center">
          <Package2 className="h-4 w-4 mr-2" />
          Required Materials
        </Label>
        <Dialog open={addMaterialDialogOpen} onOpenChange={setAddMaterialDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add New Material
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Material</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="materialName">Material Name</Label>
                <Input
                  id="materialName"
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  placeholder="Enter material name"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setAddMaterialDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addNewMaterial} disabled={isAddingMaterial}>
                  {isAddingMaterial ? 'Adding...' : 'Add Material'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {inventory.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
          {inventory.map((item) => {
            const selectedMaterial = selectedMaterials.find(m => m.id === item.id);
            const isSelected = !!selectedMaterial;
            
            return (
              <Card key={item.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleMaterialToggle(item, checked as boolean)}
                    />
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        Available: {item.quantity} {item.unit}
                      </div>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateMaterialQuantity(item.id, selectedMaterial.quantity - 1)}
                        className="h-6 w-6 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm w-8 text-center">{selectedMaterial.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateMaterialQuantity(item.id, selectedMaterial.quantity + 1)}
                        className="h-6 w-6 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-500 p-4 border rounded-md">
          No materials found in inventory. Add materials in the Inventory section.
        </div>
      )}

      {selectedMaterials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Selected Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedMaterials.map((material) => (
                <div key={material.id} className="flex justify-between items-center text-sm">
                  <span>{material.name}</span>
                  <span>{material.quantity} {material.unit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RequiredMaterials;
