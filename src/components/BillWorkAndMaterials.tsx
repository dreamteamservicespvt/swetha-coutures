import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Wrench, 
  Package, 
  Users, 
  Settings, 
  ChevronDown,
  ChevronRight,
  IndentIncrease,
  Calculator
} from 'lucide-react';
import { formatCurrency, BillItem } from '@/utils/billingUtils';
import EditableItemSelector from '@/components/EditableItemSelector';
import { WorkItem as SelectorWorkItem } from '@/components/WorkItemSelector';

export interface WorkItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

// MaterialItem interface kept for backward compatibility
export interface MaterialItem {
  id: string;
  description: string;
  inventoryId?: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface BillWorkAndMaterialsProps {
  workItems: WorkItem[];
  materialItems: MaterialItem[]; // Kept for backward compatibility
  onWorkItemsChange: (items: WorkItem[]) => void;
  onMaterialItemsChange: (items: MaterialItem[]) => void; // Kept for backward compatibility
  onBillItemsChange?: (items: BillItem[]) => void; // New prop for the enhanced bill items
  initialBillItems?: BillItem[]; // New prop to pass existing bill items for edit mode
}

// Helper function to validate if an item is complete and valid
const isItemValid = (item: BillItem): boolean => {
  return !!(item.description?.trim() && item.rate > 0 && item.quantity > 0);
};

// Helper function to get validation classes for input fields
const getValidationClasses = (item: BillItem, field: 'description' | 'rate' | 'quantity'): string => {
  const baseClasses = 'bg-white';
  
  if (field === 'description') {
    return item.description?.trim() ? baseClasses : `${baseClasses} border-red-500 border-2`;
  } else if (field === 'rate') {
    return item.rate > 0 ? baseClasses : `${baseClasses} border-red-500 border-2`;
  } else if (field === 'quantity') {
    return item.quantity > 0 ? baseClasses : `${baseClasses} border-red-500 border-2`;
  }
  
  return baseClasses;
};

const BillWorkAndMaterials: React.FC<BillWorkAndMaterialsProps> = ({
  workItems,
  onWorkItemsChange,
  onBillItemsChange,
  initialBillItems = []
}) => {
  // Enhanced bill items with sub-item support
  const [billItems, setBillItems] = useState<BillItem[]>(initialBillItems);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Initialize bill items from props or convert from work items for backward compatibility
  useEffect(() => {
    if (initialBillItems.length > 0) {
      // Use the provided initial bill items (for edit mode)
      setBillItems(initialBillItems);
      // Expand all items that have sub-items
      const itemsWithSubItems = initialBillItems
        .filter(item => item.subItems && item.subItems.length > 0)
        .map(item => item.id);
      setExpandedItems(new Set(itemsWithSubItems));
    } else if (workItems.length > 0 && billItems.length === 0) {
      // Convert work items to bill items (for create mode)
      const convertedItems: BillItem[] = workItems.map(item => ({
        id: item.id,
        type: 'service' as const,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        cost: 0,
        amount: item.amount,
        subItems: [],
        isSubItem: false
      }));
      setBillItems(convertedItems);
    }
  }, [workItems, initialBillItems]);

  // Calculate total amount for an item including sub-items
  const calculateItemTotal = (item: BillItem): number => {
    if (item.subItems && item.subItems.length > 0) {
      // If item has sub-items, sum the sub-items + main item amount
      const subItemsTotal = item.subItems.reduce((sum, subItem) => sum + subItem.amount, 0);
      const mainItemAmount = item.quantity * item.rate;
      return mainItemAmount + subItemsTotal;
    }
    return item.quantity * item.rate;
  };

  // Update item amounts when sub-items change
  const updateItemAmounts = (items: BillItem[]): BillItem[] => {
    return items.map(item => {
      const totalAmount = calculateItemTotal(item);
      return {
        ...item,
        amount: totalAmount
      };
    });
  };

  // Enhanced Bill Items Functions
  const addBillItem = () => {
    const newBillItem: BillItem = {
      id: uuidv4(),
      type: 'service',
      description: '',
      quantity: 1, // Default to 1 (positive value)
      rate: 1, // Default to 1 (positive value) instead of 0
      cost: 0,
      amount: 1, // quantity * rate = 1 * 1 = 1
      subItems: [],
      isSubItem: false
    };
    const updatedItems = [...billItems, newBillItem];
    setBillItems(updatedItems);
    updateCallbacks(updatedItems);
  };

  const addSubItem = (parentId: string) => {
    const newSubItem: BillItem = {
      id: uuidv4(),
      type: 'service',
      description: '',
      quantity: 1, // Default to 1 (positive value)
      rate: 1, // Default to 1 (positive value) instead of 0
      cost: 0,
      amount: 1, // quantity * rate = 1 * 1 = 1
      parentId: parentId,
      isSubItem: true
    };

    const updatedItems = billItems.map(item => {
      if (item.id === parentId) {
        const updatedSubItems = [...(item.subItems || []), newSubItem];
        return {
          ...item,
          subItems: updatedSubItems
        };
      }
      return item;
    });

    const itemsWithUpdatedAmounts = updateItemAmounts(updatedItems);
    setBillItems(itemsWithUpdatedAmounts);
    updateCallbacks(itemsWithUpdatedAmounts);
    
    // Expand the parent item to show the new sub-item
    setExpandedItems(prev => new Set([...prev, parentId]));
  };

  const updateBillItem = (id: string, field: keyof BillItem, value: any) => {
    const updatedItems = billItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Ensure valid numbers and prevent NaN
        if (field === 'quantity') {
          updatedItem.quantity = Math.max(1, parseInt(value) || 1);
        } else if (field === 'rate') {
          updatedItem.rate = Math.max(0, parseFloat(value) || 0);
        }
        
        // Recalculate amount with safe numbers
        const safeQuantity = updatedItem.quantity || 1;
        const safeRate = updatedItem.rate || 0;
        updatedItem.amount = safeQuantity * safeRate;
        
        return updatedItem;
      }
      
      // Check sub-items
      if (item.subItems) {
        const updatedSubItems = item.subItems.map(subItem => {
          if (subItem.id === id) {
            const updatedSubItem = { ...subItem, [field]: value };
            
            // Ensure valid numbers and prevent NaN
            if (field === 'quantity') {
              updatedSubItem.quantity = Math.max(1, parseInt(value) || 1);
            } else if (field === 'rate') {
              updatedSubItem.rate = Math.max(0, parseFloat(value) || 0);
            }
            
            // Recalculate amount with safe numbers
            const safeQuantity = updatedSubItem.quantity || 1;
            const safeRate = updatedSubItem.rate || 0;
            updatedSubItem.amount = safeQuantity * safeRate;
            
            return updatedSubItem;
          }
          return subItem;
        });
        
        if (updatedSubItems !== item.subItems) {
          return { ...item, subItems: updatedSubItems };
        }
      }
      
      return item;
    });
    
    const itemsWithUpdatedAmounts = updateItemAmounts(updatedItems);
    setBillItems(itemsWithUpdatedAmounts);
    updateCallbacks(itemsWithUpdatedAmounts);
  };

  const removeBillItem = (id: string) => {
    const updatedItems = billItems.filter(item => item.id !== id).map(item => {
      if (item.subItems) {
        const updatedSubItems = item.subItems.filter(subItem => subItem.id !== id);
        return { ...item, subItems: updatedSubItems };
      }
      return item;
    });
    
    const itemsWithUpdatedAmounts = updateItemAmounts(updatedItems);
    setBillItems(itemsWithUpdatedAmounts);
    updateCallbacks(itemsWithUpdatedAmounts);
  };

  const handleWorkItemSelect = (id: string, selectedItem: SelectorWorkItem) => {
    const updatedItems = billItems.map(item => {
      if (item.id === id) {
        const updatedItem = {
          ...item,
          type: selectedItem.type,
          sourceId: selectedItem.sourceId,
          description: selectedItem.description,
          rate: selectedItem.rate,
          cost: selectedItem.cost,
          amount: item.quantity * selectedItem.rate
        };
        return updatedItem;
      }
      
      // Check sub-items
      if (item.subItems) {
        const updatedSubItems = item.subItems.map(subItem => {
          if (subItem.id === id) {
            return {
              ...subItem,
              type: selectedItem.type,
              sourceId: selectedItem.sourceId,
              description: selectedItem.description,
              rate: selectedItem.rate,
              cost: selectedItem.cost,
              amount: subItem.quantity * selectedItem.rate
            };
          }
          return subItem;
        });
        
        if (updatedSubItems !== item.subItems) {
          return { ...item, subItems: updatedSubItems };
        }
      }
      
      return item;
    });
    
    const itemsWithUpdatedAmounts = updateItemAmounts(updatedItems);
    setBillItems(itemsWithUpdatedAmounts);
    updateCallbacks(itemsWithUpdatedAmounts);
  };

  // Toggle expansion of item to show/hide sub-items
  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(itemId)) {
        newExpanded.delete(itemId);
      } else {
        newExpanded.add(itemId);
      }
      return newExpanded;
    });
  };

  // Update callbacks for backward compatibility
  const updateCallbacks = (items: BillItem[]) => {
    // Update the new callback
    if (onBillItemsChange) {
      onBillItemsChange(items);
    }

    // Update the old callback for backward compatibility
    const legacyWorkItems: WorkItem[] = items.map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount
    }));
    onWorkItemsChange(legacyWorkItems);
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'inventory':
        return <Package className="h-4 w-4 text-green-600" />;
      case 'staff':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'service':
      default:
        return <Settings className="h-4 w-4 text-purple-600" />;
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'inventory':
        return 'Material';
      case 'staff':
        return 'Staff';
      case 'service':
      default:
        return 'Service';
    }
  };

  const renderItemRow = (item: BillItem, isSubItem: boolean = false) => {
    const isExpanded = expandedItems.has(item.id);
    const hasSubItems = item.subItems && item.subItems.length > 0;
    
    return (
      <div key={item.id} className={`space-y-2 ${isSubItem ? 'ml-2 lg:ml-6' : ''}`} id={`item-${item.id}`} data-item-id={item.id}>
        <div className={`grid grid-cols-1 lg:grid-cols-7 gap-4 p-4 border rounded-lg ${
          isSubItem 
            ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200' 
            : 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200'
        }`}>
          
          {/* Mobile: Stack everything vertically */}
          <div className="lg:hidden space-y-4">
            {/* Item Selection Header for Mobile */}
            <div className="flex items-center gap-2">
              {!isSubItem && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleItemExpansion(item.id)}
                  className="p-1 h-6 w-6"
                >
                  {hasSubItems && isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : hasSubItems ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                </Button>
              )}
              
              {isSubItem && (
                <IndentIncrease className="h-4 w-4 text-gray-400" />
              )}
              
              <Label className="text-sm font-medium text-gray-700">
                {isSubItem ? 'Sub-Item Selection *' : 'Item Selection *'}
              </Label>
            </div>
            
            <div className={`${!item.description?.trim() ? 'border-red-500 border-2 rounded-md' : ''}`}>
              <EditableItemSelector
                onSelect={(selectedItem) => handleWorkItemSelect(item.id, selectedItem)}
                selectedItem={item.sourceId ? {
                  id: item.id,
                  type: item.type,
                  sourceId: item.sourceId,
                  description: item.description,
                  rate: item.rate,
                  cost: item.cost,
                  category: '',
                  icon: getItemIcon(item.type)
                } : null}
                placeholder={isSubItem ? "Select sub-item..." : "Select work item..."}
              />
            </div>
            
            {item.type && (
              <div className="flex items-center gap-2">
                {getItemIcon(item.type)}
                <Badge variant="outline" className="text-xs">
                  {getItemTypeLabel(item.type)}
                </Badge>
                {item.cost > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Cost: ₹{item.cost}
                  </Badge>
                )}
              </div>
            )}

            {/* Mobile: Quantity and Rate in a row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`item-qty-mobile-${item.id}`} className="text-sm font-medium text-gray-700">
                  Quantity *
                </Label>
                <NumberInput
                  id={`item-qty-mobile-${item.id}`}
                  value={item.quantity == null || isNaN(item.quantity) ? '' : item.quantity}
                  onChange={(value) => {
                    if (value !== null && value > 0) {
                      updateBillItem(item.id, 'quantity', value);
                    }
                  }}
                  min={1}
                  allowEmpty={false}
                  emptyValue={1}
                  className={getValidationClasses(item, 'quantity')}
                  required
                />
              </div>
              <div>
                <Label htmlFor={`item-rate-mobile-${item.id}`} className="text-sm font-medium text-gray-700">
                  Rate (₹) *
                </Label>
                <NumberInput
                  id={`item-rate-mobile-${item.id}`}
                  value={item.rate == null || item.rate === 0 || isNaN(item.rate) ? '' : item.rate}
                  onChange={(value) => {
                    if (value !== null && value > 0) {
                      updateBillItem(item.id, 'rate', value);
                    }
                  }}
                  min={0.01}
                  step={0.01}
                  decimals={2}
                  allowEmpty={false}
                  emptyValue={0.01}
                  className={getValidationClasses(item, 'rate')}
                  required
                />
              </div>
            </div>

            {/* Mobile: Amount and ROI row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  {hasSubItems ? 'Total (₹)' : 'Amount (₹)'}
                </Label>
                <div className="p-2 bg-gray-100 border border-gray-200 rounded-md">
                  <div className="flex items-center gap-2">
                    {hasSubItems && (
                      <Calculator className="h-4 w-4 text-green-600" />
                    )}
                    <span className="font-semibold text-green-700 text-sm">
                      {formatCurrency(item.amount || 0)}
                    </span>
                  </div>
                  {hasSubItems && (
                    <div className="text-xs text-gray-600 mt-1">
                      Main: ₹{(item.quantity * item.rate).toFixed(2)} + 
                      Sub: ₹{(item.subItems?.reduce((sum, sub) => sum + sub.amount, 0) || 0).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              
              {item.cost > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">ROI</Label>
                  <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-xs text-green-800">
                      ₹{((item.rate - item.cost) * item.quantity).toFixed(2)}
                    </div>
                    <div className="text-xs text-green-600">
                      {item.rate > 0 ? (((item.rate - item.cost) / item.rate) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile: Action buttons */}
            <div className="flex justify-end gap-2">
              {!isSubItem && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addSubItem(item.id)}
                  className="text-blue-600 hover:bg-blue-50 hover:border-blue-200"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Sub-Item
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeBillItem(item.id)}
                className="text-red-600 hover:bg-red-50 hover:border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>

          {/* Desktop: Original layout */}
          <div className="hidden lg:contents">
            {/* Item Selection with Expansion Toggle */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                {!isSubItem && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleItemExpansion(item.id)}
                    className="p-1 h-6 w-6"
                  >
                    {hasSubItems && isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : hasSubItems ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <div className="h-4 w-4" />
                    )}
                  </Button>
                )}
                
                {isSubItem && (
                  <IndentIncrease className="h-4 w-4 text-gray-400" />
                )}
                
                <Label className="text-sm font-medium text-gray-700">
                  {isSubItem ? 'Sub-Item Selection *' : 'Item Selection *'}
                </Label>
              </div>
                  <div className={`mt-1 ${!item.description?.trim() ? 'border-red-500 border-2 rounded-md' : ''}`}>
              <EditableItemSelector
                onSelect={(selectedItem) => handleWorkItemSelect(item.id, selectedItem)}
                selectedItem={item.sourceId ? {
                  id: item.id,
                  type: item.type,
                  sourceId: item.sourceId,
                  description: item.description,
                  rate: item.rate,
                  cost: item.cost,
                  category: '',
                  icon: getItemIcon(item.type)
                } : null}
                placeholder={isSubItem ? "Select sub-item..." : "Select work item..."}
                className="mt-1"
              />
            </div>
              
              {item.type && (
                <div className="flex items-center gap-2 mt-2">
                  {getItemIcon(item.type)}
                  <Badge variant="outline" className="text-xs">
                    {getItemTypeLabel(item.type)}
                  </Badge>
                  {item.cost > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Cost: ₹{item.cost}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div>
              <Label htmlFor={`item-qty-${item.id}`} className="text-sm font-medium text-gray-700">
                Quantity *
              </Label>
              <NumberInput
                id={`item-qty-${item.id}`}
                value={item.quantity == null || isNaN(item.quantity) ? '' : item.quantity}
                onChange={(value) => {
                  if (value !== null && value > 0) {
                    updateBillItem(item.id, 'quantity', value);
                  }
                }}
                min={1}
                allowEmpty={false}
                emptyValue={1}
                className={`mt-1 ${getValidationClasses(item, 'quantity')}`}
                required
              />
            </div>

            {/* Rate */}
            <div>
              <Label htmlFor={`item-rate-${item.id}`} className="text-sm font-medium text-gray-700">
                Rate (₹) *
              </Label>
              <NumberInput
                id={`item-rate-${item.id}`}
                value={item.rate == null || item.rate === 0 || isNaN(item.rate) ? '' : item.rate}
                onChange={(value) => {
                  if (value !== null && value >= 0) {
                    updateBillItem(item.id, 'rate', value);
                  }
                }}
                min={0}
                step={0.01}
                decimals={2}
                allowEmpty={false}
                emptyValue={0}
                className={`mt-1 ${getValidationClasses(item, 'rate')}`}
                placeholder="Enter rate"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <Label className="text-sm font-medium text-gray-700">
                {hasSubItems ? 'Total (₹)' : 'Amount (₹)'}
              </Label>
              <div className="mt-1 p-2 bg-gray-100 border border-gray-200 rounded-md">
                <div className="flex items-center gap-2">
                  {hasSubItems && (
                    <Calculator className="h-4 w-4 text-green-600" />
                  )}
                  <span className="font-semibold text-green-700">
                    {formatCurrency(item.amount || 0)}
                  </span>
                </div>
                {hasSubItems && (
                  <div className="text-xs text-gray-600 mt-1">
                    Main: ₹{(item.quantity * item.rate).toFixed(2)} + 
                    Sub: ₹{(item.subItems?.reduce((sum, sub) => sum + sub.amount, 0) || 0).toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* ROI Display */}
            {item.cost > 0 && (
              <div>
                <Label className="text-sm font-medium text-gray-700">ROI</Label>
                <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded-md">
                  <div className="text-xs text-green-800">
                    Profit: ₹{((item.rate - item.cost) * item.quantity).toFixed(2)}
                  </div>
                  <div className="text-xs text-green-600">
                    Margin: {item.rate > 0 ? (((item.rate - item.cost) / item.rate) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-end justify-center gap-2">
              {!isSubItem && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addSubItem(item.id)}
                  className="text-blue-600 hover:bg-blue-50 hover:border-blue-200"
                  title="Add sub-item"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeBillItem(item.id)}
                className="text-red-600 hover:bg-red-50 hover:border-red-200"
                title="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sub-items */}
        {!isSubItem && hasSubItems && isExpanded && (
          <div className="space-y-2 border-l-2 border-purple-200 pl-2 lg:pl-4">
            {item.subItems!.map(subItem => renderItemRow(subItem, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Work Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-purple-600" />
              Work Items & Materials
            </div>
            <Button type="button" onClick={addBillItem} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {billItems.map(item => renderItemRow(item))}
            
            {billItems.length === 0 && (
              <div className="text-center py-8 text-gray-500 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-dashed border-purple-200">
                <Wrench className="h-12 w-12 mx-auto mb-4 text-purple-400" />
                <p className="text-lg font-medium">No items added yet</p>
                <p className="text-sm">Click "Add Item" to add services, materials, or staff work</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Validation Summary */}
      {billItems.length > 0 && (
        <Card className="mt-4">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  billItems.every(item => isItemValid(item)) ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm font-medium">
                  {billItems.every(item => isItemValid(item)) 
                    ? 'All items are valid' 
                    : `${billItems.filter(item => !isItemValid(item)).length} item(s) need attention`
                  }
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Total Items: {billItems.length} | Total Amount: {formatCurrency(billItems.reduce((sum, item) => sum + item.amount, 0))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BillWorkAndMaterials;
