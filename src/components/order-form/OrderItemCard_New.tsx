import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import StaffAssignment from '@/components/StaffAssignment';
import RequiredMaterials from '@/components/RequiredMaterials';
import { OrderItem, Staff, Material } from '@/types/orderTypes';

interface OrderItemCardProps {
  item: OrderItem;
  index: number;
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  staff: Staff[];
  materials: Material[];
}

const OrderItemCard: React.FC<OrderItemCardProps> = ({
  item,
  index,
  onUpdate,
  onRemove,
  canRemove,
  staff,
  materials
}) => {
  const [customSizeLabel, setCustomSizeLabel] = useState('');
  const [customSizeValue, setCustomSizeValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(index === 0); // First item expanded by default

  const itemTypes = [
    'Lehenga', 'Saree Blouse', 'Salwar Kameez', 'Kurti', 'Gown', 'Dress',
    'Shirt', 'Pants', 'Skirt', 'Jacket', 'Suit', 'Bridal Wear', 'Party Wear',
    'Casual Wear', 'Formal Wear', 'Traditional Wear', 'Western Wear', 'Other'
  ];

  const statusOptions = [
    { value: 'received', label: 'Received' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'ready', label: 'Ready' },
    { value: 'delivered', label: 'Delivered' }
  ];

  // Size templates based on item type
  const getSizeTemplate = (itemType: string): string[] => {
    switch (itemType.toLowerCase()) {
      case 'lehenga':
        return ['Bust', 'Waist', 'Hip', 'Length', 'Blouse Length'];
      case 'saree blouse':
        return ['Bust', 'Waist', 'Shoulder', 'Sleeve Length', 'Blouse Length'];
      case 'salwar kameez':
        return ['Bust', 'Waist', 'Hip', 'Kameez Length', 'Sleeve Length', 'Bottom Length'];
      case 'kurti':
        return ['Bust', 'Waist', 'Hip', 'Length', 'Sleeve Length'];
      case 'gown':
      case 'dress':
        return ['Bust', 'Waist', 'Hip', 'Length', 'Sleeve Length'];
      case 'shirt':
        return ['Chest', 'Waist', 'Shoulder', 'Sleeve Length', 'Length'];
      case 'pants':
        return ['Waist', 'Hip', 'Thigh', 'Length', 'Bottom'];
      default:
        return ['Bust', 'Waist', 'Hip', 'Length'];
    }
  };

  const handleItemTypeChange = (newType: string) => {
    onUpdate(index, 'category', newType);
    
    // Auto-populate default sizes for the new item type
    const template = getSizeTemplate(newType);
    const newSizes: Record<string, string> = {};
    template.forEach(size => {
      newSizes[size] = item.sizes?.[size] || '';
    });
    onUpdate(index, 'sizes', newSizes);
  };

  const handleSizeChange = (sizeKey: string, value: string) => {
    const updatedSizes = { ...item.sizes, [sizeKey]: value };
    onUpdate(index, 'sizes', updatedSizes);
  };

  const handleAddCustomSize = () => {
    if (customSizeLabel.trim() && customSizeValue.trim()) {
      const updatedSizes = { ...item.sizes, [customSizeLabel]: customSizeValue };
      onUpdate(index, 'sizes', updatedSizes);
      setCustomSizeLabel('');
      setCustomSizeValue('');
    }
  };

  const handleRemoveSize = (sizeKey: string) => {
    const updatedSizes = { ...item.sizes };
    delete updatedSizes[sizeKey];
    onUpdate(index, 'sizes', updatedSizes);
  };

  const currentSizeTemplate = getSizeTemplate(item.category);
  const allSizeKeys = [...new Set([...currentSizeTemplate, ...Object.keys(item.sizes || {})])];

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="relative">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                Item {index + 1}
                {item.madeFor && (
                  <Badge variant="outline" className="ml-2 text-purple-600">
                    For: {item.madeFor}
                  </Badge>
                )}
                {item.category && (
                  <Badge variant="secondary" className="ml-2">
                    {item.category}
                  </Badge>
                )}
              </CardTitle>
              {canRemove && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`madeFor-${index}`}>Made For</Label>
                <Input
                  id={`madeFor-${index}`}
                  value={item.madeFor}
                  onChange={(e) => onUpdate(index, 'madeFor', e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div>
                <Label htmlFor={`category-${index}`}>Item Type *</Label>
                <Select value={item.category} onValueChange={handleItemTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item type" />
                  </SelectTrigger>
                  <SelectContent>
                    {itemTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor={`description-${index}`}>Description</Label>
                <Input
                  id={`description-${index}`}
                  value={item.description}
                  onChange={(e) => onUpdate(index, 'description', e.target.value)}
                  placeholder="Brief description"
                />
              </div>
              <div>
                <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                <Input
                  id={`quantity-${index}`}
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => onUpdate(index, 'quantity', parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label htmlFor={`status-${index}`}>Status</Label>
                <Select value={item.status} onValueChange={(value) => onUpdate(index, 'status', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`orderDate-${index}`}>Order Date</Label>
                <Input
                  id={`orderDate-${index}`}
                  type="date"
                  value={item.orderDate}
                  onChange={(e) => onUpdate(index, 'orderDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`deliveryDate-${index}`}>Delivery Date *</Label>
                <Input
                  id={`deliveryDate-${index}`}
                  type="date"
                  value={item.deliveryDate}
                  onChange={(e) => onUpdate(index, 'deliveryDate', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Dynamic Size Inputs */}
            {item.category && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Sizes & Measurements</Label>
                </div>
                
                {allSizeKeys.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allSizeKeys.map((sizeKey) => (
                      <div key={sizeKey} className="flex items-center space-x-2">
                        <div className="flex-1">
                          <Label htmlFor={`size-${sizeKey}-${index}`} className="text-sm">
                            {sizeKey}
                          </Label>
                          <Input
                            id={`size-${sizeKey}-${index}`}
                            value={item.sizes?.[sizeKey] || ''}
                            onChange={(e) => handleSizeChange(sizeKey, e.target.value)}
                            placeholder="inches"
                            className="text-sm"
                          />
                        </div>
                        {!currentSizeTemplate.includes(sizeKey) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSize(sizeKey)}
                            className="text-red-600 hover:bg-red-50 mt-5"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Custom Size */}
                <div className="border-t pt-4">
                  <div className="flex items-end space-x-2">
                    <div className="flex-1">
                      <Label htmlFor={`customSizeLabel-${index}`} className="text-sm">
                        Custom Size Label
                      </Label>
                      <Input
                        id={`customSizeLabel-${index}`}
                        value={customSizeLabel}
                        onChange={(e) => setCustomSizeLabel(e.target.value)}
                        placeholder="e.g., Arm Hole"
                        className="text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor={`customSizeValue-${index}`} className="text-sm">
                        Value
                      </Label>
                      <Input
                        id={`customSizeValue-${index}`}
                        value={customSizeValue}
                        onChange={(e) => setCustomSizeValue(e.target.value)}
                        placeholder="inches"
                        className="text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCustomSize}
                      disabled={!customSizeLabel.trim() || !customSizeValue.trim()}
                      className="flex items-center space-x-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Size</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Staff Assignment */}
            <div>
              <Label className="text-base font-medium mb-2 block">Assigned Staff</Label>
              <StaffAssignment
                selectedStaff={item.assignedStaff}
                onChange={(staffIds) => onUpdate(index, 'assignedStaff', staffIds)}
              />
            </div>

            {/* Required Materials */}
            <div>
              <Label className="text-base font-medium mb-2 block">Required Materials</Label>
              <RequiredMaterials
                selectedMaterials={item.requiredMaterials}
                onChange={(materials) => onUpdate(index, 'requiredMaterials', materials)}
              />
            </div>

            {/* Design Images - Simple display only */}
            <div>
              <Label className="text-base font-medium mb-2 block">Design Images</Label>
              <div className="text-sm text-gray-500">
                {item.designImages && item.designImages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {item.designImages.map((image, imgIndex) => (
                      <div key={imgIndex} className="p-2 bg-gray-100 rounded text-xs">
                        Image {imgIndex + 1}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span>No design images uploaded</span>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor={`notes-${index}`}>Notes</Label>
              <Textarea
                id={`notes-${index}`}
                value={item.notes}
                onChange={(e) => onUpdate(index, 'notes', e.target.value)}
                placeholder="Additional notes or special instructions"
                rows={3}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default OrderItemCard;
