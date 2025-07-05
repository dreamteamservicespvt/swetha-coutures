import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Plus, 
  Search, 
  Package, 
  Users, 
  Settings, 
  Star,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { WorkItem } from '@/components/WorkItemSelector';
import { getWorkDescriptions, addWorkDescription } from '@/utils/workDescriptions';

interface EditableItemSelectorProps {
  onSelect: (item: WorkItem) => void;
  selectedItem?: WorkItem | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  role?: string;
  designation?: string;
  billingRate?: number;
  costRate?: number;
  activeOrdersCount?: number;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  type: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  sellingPrice?: number;
  totalValue: number;
  reorderLevel: number;
  supplier?: {
    name: string;
    phone: string;
    email?: string;
  };
  location: string;
  notes?: string;
  lastUpdated: any;
  createdAt: any;
}

const EditableItemSelector: React.FC<EditableItemSelectorProps> = ({
  onSelect,
  selectedItem,
  placeholder = "Type or select item...",
  disabled = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WorkItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newItemType, setNewItemType] = useState<'work' | 'material' | null>(null);
  const [newItemDetails, setNewItemDetails] = useState({
    name: '',
    category: '',
    type: '',
    rate: 0,
    cost: 0,
    quantity: 10,
    unit: 'pieces',
    supplierName: '',
    supplierPhone: '',
    supplierEmail: ''
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize search term with selected item description - only if user hasn't interacted
  useEffect(() => {
    if (selectedItem && !userHasInteracted) {
      setSearchTerm(selectedItem.description);
    }
  }, [selectedItem, userHasInteracted]);

  // Fetch all work items on component mount
  useEffect(() => {
    fetchWorkItems();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter items based on search term and category
  useEffect(() => {
    let filtered = workItems;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => {
        const itemCategory = item.category || 'uncategorized';
        return itemCategory.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.category || 'uncategorized').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by usage count (most used first) and then by description
    filtered.sort((a, b) => {
      if (a.usageCount !== b.usageCount) {
        return (b.usageCount || 0) - (a.usageCount || 0);
      }
      return a.description.localeCompare(b.description);
    });

    setFilteredItems(filtered);
  }, [workItems, searchTerm, selectedCategory]);

  // Check if search term matches any existing item
  const hasExactMatch = workItems.some(item => 
    item.description.toLowerCase() === searchTerm.toLowerCase()
  );

  const fetchWorkItems = async () => {
    setLoading(true);
    try {
      const items: WorkItem[] = [];

      // Only fetch inventory items and staff roles for ROI calculations
      // Fetch inventory items
      const inventorySnapshot = await getDocs(collection(db, 'inventory'));
      inventorySnapshot.forEach(doc => {
        const item = { id: doc.id, ...doc.data() } as InventoryItem;
        const sellingPrice = item.sellingPrice || (item.costPerUnit * 1.25);
        
        items.push({
          id: item.id,
          type: 'inventory',
          sourceId: item.id,
          description: `${item.name} (${item.category || 'Material'})`,
          rate: sellingPrice,
          cost: item.costPerUnit,
          category: item.category || 'Materials',
          unit: item.unit,
          availableQuantity: item.quantity,
          usageCount: 0,
          icon: <Package className="h-4 w-4" />
        });
      });

      // Fetch staff members - Only show profession, not names
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      staffSnapshot.forEach(doc => {
        const staff = { id: doc.id, ...doc.data() } as StaffMember;
        const profession = staff.role || staff.designation || 'Staff';
        
        items.push({
          id: staff.id,
          type: 'staff',
          sourceId: staff.id,
          description: profession, // Only show profession, not name
          rate: staff.billingRate || 0,
          cost: staff.costRate || 0,
          category: profession,
          staffRole: profession,
          usageCount: 0,
          icon: <Users className="h-4 w-4" />
        });
      });

      setWorkItems(items);
    } catch (error) {
      console.error('Error fetching work items:', error);
      toast({
        title: "Error",
        description: "Failed to load work items. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: WorkItem) => {
    onSelect(item);
    setIsOpen(false);
    setSearchTerm(item.description);
    setUserHasInteracted(false); // Reset interaction flag when item is selected
  };

  const handleCreateCustomItem = async () => {
    if (!newItemType || !newItemDetails.name.trim()) {
      toast({
        title: "Error",
        description: "Please provide item name and select type.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (newItemType === 'work') {
        // For work items, create a staff role without asking for additional details
        toast({
          title: "Info",
          description: "Work items should be managed through staff roles. Please add staff members from the Staff page.",
        });
        setShowCreateDialog(false);
        return;
      } else if (newItemType === 'material') {
        // Add to inventory with all required inventory fields
        const sellingPrice = newItemDetails.rate > 0 ? newItemDetails.rate : newItemDetails.cost * 1.25; // 25% markup if no selling price provided
        const totalCost = newItemDetails.cost * newItemDetails.quantity;
        const newInventoryItem = {
          name: newItemDetails.name,
          category: newItemDetails.category || 'Custom Materials',
          type: newItemDetails.type || 'Material',
          quantity: newItemDetails.quantity,
          unit: newItemDetails.unit,
          costPerUnit: newItemDetails.cost,
          sellingPrice: sellingPrice,
          totalValue: totalCost,
          reorderLevel: Math.floor(newItemDetails.quantity * 0.2), // 20% of initial quantity
          supplier: {
            name: newItemDetails.supplierName || 'Custom',
            phone: newItemDetails.supplierPhone || '',
            email: newItemDetails.supplierEmail || ''
          },
          location: 'Custom',
          notes: 'Custom item added from billing',
          lastUpdated: new Date(),
          createdAt: new Date()
        };
        
        const inventoryDoc = await addDoc(collection(db, 'inventory'), newInventoryItem);
        
        // Create and select the new inventory item
        const newWorkItem: WorkItem = {
          id: inventoryDoc.id,
          type: 'inventory',
          sourceId: inventoryDoc.id,
          description: `${newItemDetails.name} (${newItemDetails.category || 'Custom Materials'})`,
          rate: sellingPrice,
          cost: newItemDetails.cost,
          category: newItemDetails.category || 'Custom Materials',
          unit: newItemDetails.unit,
          availableQuantity: newItemDetails.quantity,
          usageCount: 0,
          icon: <Package className="h-4 w-4" />
        };
        
        onSelect(newWorkItem);
        
        toast({
          title: "Success",
          description: `Material "${newItemDetails.name}" added to inventory with ${newItemDetails.quantity} ${newItemDetails.unit}.`,
        });
      }
      
      // Reset form and close dialog
      setNewItemDetails({
        name: '',
        category: '',
        type: '',
        rate: 0,
        cost: 0,
        quantity: 10,
        unit: 'pieces',
        supplierName: '',
        supplierPhone: '',
        supplierEmail: ''
      });
      setNewItemType(null);
      setShowCreateDialog(false);
      setIsOpen(false);
      setSearchTerm('');
      
      // Refresh items
      fetchWorkItems();
      
    } catch (error) {
      console.error('Error creating custom item:', error);
      toast({
        title: "Error",
        description: "Failed to create custom item. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserHasInteracted(true); // Mark that user has interacted with input
    setSearchTerm(value);
    if (!isOpen && value.length > 0) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim() && !hasExactMatch) {
      e.preventDefault();
      setNewItemDetails(prev => ({ ...prev, name: searchTerm.trim() }));
      setShowCreateDialog(true);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      // Also reset to selected item if there is one
      if (selectedItem && !userHasInteracted) {
        setSearchTerm(selectedItem.description);
      }
    }
  };

  const handleAddCustomClick = () => {
    setNewItemDetails(prev => ({ ...prev, name: searchTerm.trim() }));
    setShowCreateDialog(true);
  };

  const handleAddCustomClickWithEventPrevention = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleAddCustomClick();
  };

  // Filter out empty categories and ensure all values are valid
  const categories = Array.from(new Set(workItems.map(item => item.category)))
    .filter(category => category && category.trim() !== '')
    .sort();

  return (
    <div className={`relative ${className}`}>
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onFocus={handleInputFocus}
        disabled={disabled}
        className="w-full"
      />

      {isOpen && (
        <Card ref={dropdownRef} className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg max-h-96 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 space-y-4">
              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category || 'uncategorized'} value={category || 'uncategorized'}>
                      {category || 'Uncategorized'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Add Custom Item Option */}
              {searchTerm.trim() && !hasExactMatch && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      Add "{searchTerm}" as new custom item
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddCustomClickWithEventPrevention}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Custom Item
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Items List */}
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading work items...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No items found matching your search.
                </div>
              ) : (
                <div className="p-2">
                  {filteredItems.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelect(item)}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors"
                    >
                      {item.icon}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{item.description}</span>
                          {item.usageCount && item.usageCount > 0 && (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500 fill-current" />
                              <span className="text-xs text-muted-foreground">{item.usageCount}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {item.type === 'inventory' ? 'Material' : 
                             item.type === 'staff' ? 'Staff' : 'Service'}
                          </Badge>
                          <span>{item.category || 'Uncategorized'}</span>
                          {item.availableQuantity !== undefined && (
                            <span className="text-xs">
                              Stock: {item.availableQuantity} {item.unit || 'units'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">₹{item.rate}</div>
                        {item.cost > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Cost: ₹{item.cost}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Custom Item Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Custom Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="itemName">Item Name *</Label>
              <Input
                id="itemName"
                value={newItemDetails.name}
                onChange={(e) => setNewItemDetails(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter item name"
              />
            </div>

            <div>
              <Label>Item Type *</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={newItemType === 'work' ? 'default' : 'outline'}
                  onClick={() => setNewItemType('work')}
                  className="flex-1"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Work Item (Staff Role)
                </Button>
                <Button
                  type="button"
                  variant={newItemType === 'material' ? 'default' : 'outline'}
                  onClick={() => setNewItemType('material')}
                  className="flex-1"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Material
                </Button>
              </div>
              {newItemType === 'work' && (
                <p className="text-xs text-muted-foreground mt-2">
                  Work items should be managed through staff roles. Please add staff members from the Staff page for proper ROI tracking.
                </p>
              )}
            </div>

            {newItemType === 'material' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="itemCategory">Category *</Label>
                    <Input
                      id="itemCategory"
                      value={newItemDetails.category}
                      onChange={(e) => setNewItemDetails(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="e.g., Fabric, Thread, Buttons"
                    />
                  </div>
                  <div>
                    <Label htmlFor="itemType">Type *</Label>
                    <Input
                      id="itemType"
                      value={newItemDetails.type}
                      onChange={(e) => setNewItemDetails(prev => ({ ...prev, type: e.target.value }))}
                      placeholder="e.g., Cotton, Silk, Wool"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="itemQuantity">Quantity *</Label>
                    <Input
                      id="itemQuantity"
                      type="number"
                      value={newItemDetails.quantity}
                      onChange={(e) => setNewItemDetails(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                      placeholder="Initial stock"
                      min="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="itemUnit">Unit *</Label>
                    <Input
                      id="itemUnit"
                      value={newItemDetails.unit}
                      onChange={(e) => setNewItemDetails(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="pieces, meters, yards"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="itemCost">Unit Cost (₹) *</Label>
                    <Input
                      id="itemCost"
                      type="number"
                      value={newItemDetails.cost}
                      onChange={(e) => setNewItemDetails(prev => ({ ...prev, cost: Number(e.target.value) }))}
                      placeholder="Cost per unit"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="itemRate">Selling Price (₹)</Label>
                    <Input
                      id="itemRate"
                      type="number"
                      value={newItemDetails.rate}
                      onChange={(e) => setNewItemDetails(prev => ({ ...prev, rate: Number(e.target.value) }))}
                      placeholder="Auto-calculated if empty"
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty for 25% markup on cost
                    </p>
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium mb-1">Total Value</p>
                  <p className="text-lg font-bold">
                    ₹{(newItemDetails.quantity * newItemDetails.cost).toLocaleString()}
                  </p>
                </div>

                <div>
                  <Label className="text-base font-medium">Supplier Information</Label>
                  <div className="grid grid-cols-1 gap-4 mt-2">
                    <div>
                      <Label htmlFor="supplierName">Supplier Name</Label>
                      <Input
                        id="supplierName"
                        value={newItemDetails.supplierName}
                        onChange={(e) => setNewItemDetails(prev => ({ ...prev, supplierName: e.target.value }))}
                        placeholder="Supplier name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="supplierPhone">Supplier Phone</Label>
                        <Input
                          id="supplierPhone"
                          value={newItemDetails.supplierPhone}
                          onChange={(e) => setNewItemDetails(prev => ({ ...prev, supplierPhone: e.target.value }))}
                          placeholder="Phone number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="supplierEmail">Supplier Email</Label>
                        <Input
                          id="supplierEmail"
                          type="email"
                          value={newItemDetails.supplierEmail}
                          onChange={(e) => setNewItemDetails(prev => ({ ...prev, supplierEmail: e.target.value }))}
                          placeholder="Email address"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateCustomItem}
                disabled={!newItemType || !newItemDetails.name.trim() || 
                  (newItemType === 'material' && (!newItemDetails.category || !newItemDetails.cost || !newItemDetails.quantity))}
              >
                <Plus className="h-4 w-4 mr-2" />
                {newItemType === 'work' ? 'Redirect to Staff Page' : 'Create Material'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EditableItemSelector;
