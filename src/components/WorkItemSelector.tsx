import React, { useState, useEffect } from 'react';
import { Search, Package, Users, Settings, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { WorkDescription, getWorkDescriptions } from '@/utils/workDescriptions';

// Interface for staff member
interface StaffMember {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  role?: string;
  designation?: string;
  billingRate?: number; // Rate charged to customers
  costRate?: number; // Cost to business (salary/hourly rate)
  activeOrdersCount?: number;
}

// Interface for inventory item
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  type: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  sellingPrice?: number; // If not set, use costPerUnit * 1.25 as default markup
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

// Unified work item interface
export interface WorkItem {
  id: string;
  type: 'inventory' | 'staff' | 'service';
  sourceId: string;
  description: string;
  rate: number; // Selling price
  cost: number; // Cost to business
  category: string;
  unit?: string;
  availableQuantity?: number;
  usageCount?: number;
  staffRole?: string;
  icon: React.ReactNode;
}

interface WorkItemSelectorProps {
  onSelect: (item: WorkItem) => void;
  selectedItem?: WorkItem | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const WorkItemSelector: React.FC<WorkItemSelectorProps> = ({
  onSelect,
  selectedItem,
  placeholder = "Select work item...",
  disabled = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WorkItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch all work items on component mount
  useEffect(() => {
    fetchWorkItems();
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

  const fetchWorkItems = async () => {
    setLoading(true);
    try {
      const items: WorkItem[] = [];

      // Fetch work descriptions (services)
      const workDescriptions = await getWorkDescriptions();
      workDescriptions.forEach(work => {
        items.push({
          id: work.id,
          type: 'service',
          sourceId: work.id,
          description: work.description,
          rate: work.defaultRate || 0,
          cost: 0, // Services typically have no direct cost
          category: work.category || 'Services',
          usageCount: work.usageCount,
          icon: <Settings className="h-4 w-4" />
        });
      });

      // Fetch inventory items
      const inventorySnapshot = await getDocs(collection(db, 'inventory'));
      inventorySnapshot.forEach(doc => {
        const item = { id: doc.id, ...doc.data() } as InventoryItem;
        const sellingPrice = item.sellingPrice || (item.costPerUnit * 1.25); // 25% markup if no selling price set
        
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
          usageCount: 0, // Can be tracked separately in future
          icon: <Package className="h-4 w-4" />
        });
      });

      // Fetch staff members
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      staffSnapshot.forEach(doc => {
        const staff = { id: doc.id, ...doc.data() } as StaffMember;
        
        items.push({
          id: staff.id,
          type: 'staff',
          sourceId: staff.id,
          description: `${staff.name} - ${staff.role || staff.designation || 'Staff'}`,
          rate: staff.billingRate || 0,
          cost: staff.costRate || 0,
          category: staff.role || staff.designation || 'Staff',
          staffRole: staff.role || staff.designation,
          usageCount: 0, // Can be tracked separately in future
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

  const handleSelect = (item: WorkItem, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    onSelect(item);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Filter out empty categories and ensure all values are valid
  const categories = Array.from(new Set(workItems.map(item => item.category)))
    .filter(category => category && category.trim() !== '')
    .sort();

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full justify-between"
      >
        {selectedItem ? (
          <div className="flex items-center gap-2">
            {selectedItem.icon}
            <span className="truncate">{selectedItem.description}</span>
            <Badge variant="secondary">₹{selectedItem.rate}</Badge>
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <Search className="h-4 w-4 shrink-0" />
      </Button>

      {isOpen && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg">
          <CardContent className="p-0">
            <div className="p-4 space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search work items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

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
            </div>

            <Separator />

            {/* Items List */}
            <ScrollArea className="h-64">
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
                      onClick={(event) => handleSelect(item, event)}
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
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WorkItemSelector;
