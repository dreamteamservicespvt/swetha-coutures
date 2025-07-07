import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, X, ChevronDown, ChevronRight, Palette, Upload } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ToolDesignCanvas from '@/components/ToolDesignCanvas';
import { OrderItem, Staff, Material } from '@/types/orderTypes';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { uploadMultipleToCloudinary } from '@/utils/cloudinaryConfig';
import { getSizeSuggestions, getMadeForSuggestions, MadeForSuggestion } from '@/utils/customerHistoryUtils';

interface OrderItemCardProps {
  item: OrderItem;
  index: number;
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  staff: Staff[];
  materials: Material[];
  customerName?: string; // Add customer name for history lookup
  orderId?: string; // Optional orderId for design state persistence
  onDeliveryDateChange?: (index: number, date: string) => void; // Add delivery date sync handler
}

const OrderItemCard: React.FC<OrderItemCardProps> = ({
  item,
  index,
  onUpdate,
  onRemove,
  canRemove,
  staff,
  materials,
  customerName,
  orderId,
  onDeliveryDateChange
}) => {
  const [customSizeLabel, setCustomSizeLabel] = useState('');
  const [customSizeValue, setCustomSizeValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(index === 0); // First item expanded by default
  const [madeForSuggestions, setMadeForSuggestions] = useState<MadeForSuggestion[]>([]);
  const [showMadeForSuggestions, setShowMadeForSuggestions] = useState(false);
  const [sizeSuggestions, setSizeSuggestions] = useState<Record<string, string> | null>(null);
  const [showSizeSuggestions, setShowSizeSuggestions] = useState(false);
  const [itemTypes, setItemTypes] = useState([
    'Lehenga', 'Saree Blouse', 'Salwar Kameez', 'Kurti', 'Gown', 'Dress',
    'Shirt', 'Pants', 'Skirt', 'Jacket', 'Suit', 'Bridal Wear', 'Party Wear',
    'Casual Wear', 'Formal Wear', 'Traditional Wear', 'Western Wear', 'Other'
  ]);
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');
  const [showDesignCanvas, setShowDesignCanvas] = useState(false);
  
  // Local state for delivery date to ensure proper control
  const [localDeliveryDate, setLocalDeliveryDate] = useState(item.deliveryDate || '');

  // Update local state when prop changes - but only if it's different to avoid loops
  useEffect(() => {
    if (item.deliveryDate && item.deliveryDate !== localDeliveryDate) {
      setLocalDeliveryDate(item.deliveryDate);
    }
  }, [item.deliveryDate, index]);

  const statusOptions = [
    { value: 'received', label: 'Received' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'ready', label: 'Ready' },
    { value: 'delivered', label: 'Delivered' }
  ];

  // Auto-fill "Made For" field when customer name changes or when the item is first created
  useEffect(() => {
    if (customerName && customerName.trim()) {
      // Only auto-fill if the madeFor field is empty
      if (!item.madeFor || !item.madeFor.trim()) {
        onUpdate(index, 'madeFor', customerName);
      }
    }
  }, [customerName, index]);

  // Load custom item types from Firebase
  useEffect(() => {
    const loadCustomTypes = async () => {
      try {
        const customTypesSnapshot = await getDocs(collection(db, 'customItemTypes'));
        const customTypes = customTypesSnapshot.docs.map(doc => doc.data().name);
        const allTypes = [
          'Lehenga', 'Saree Blouse', 'Salwar Kameez', 'Kurti', 'Gown', 'Dress',
          'Shirt', 'Pants', 'Skirt', 'Jacket', 'Suit', 'Bridal Wear', 'Party Wear',
          'Casual Wear', 'Formal Wear', 'Traditional Wear', 'Western Wear',
          ...customTypes,
          'Other'
        ];
        setItemTypes([...new Set(allTypes)]); // Remove duplicates
      } catch (error) {
        console.error('Error loading custom types:', error);
      }
    };
    loadCustomTypes();
  }, []);

  // Load made for suggestions when customer name is available
  useEffect(() => {
    const loadMadeForSuggestions = async () => {
      if (customerName && customerName.trim()) {
        try {
          const suggestions = await getMadeForSuggestions(customerName);
          setMadeForSuggestions(suggestions);
        } catch (error) {
          console.error('Error loading made for suggestions:', error);
        }
      }
    };
    loadMadeForSuggestions();
  }, [customerName]);

  // Load size suggestions when item type or made for changes
  useEffect(() => {
    const loadSizeSuggestions = async () => {
      if (customerName && item.category && item.madeFor) {
        try {
          const suggestions = await getSizeSuggestions(customerName, item.category, item.madeFor);
          if (suggestions && Object.keys(suggestions).length > 0) {
            setSizeSuggestions(suggestions);
            setShowSizeSuggestions(true);
          } else {
            setSizeSuggestions(null);
            setShowSizeSuggestions(false);
          }
        } catch (error) {
          console.error('Error loading size suggestions:', error);
          setSizeSuggestions(null);
          setShowSizeSuggestions(false);
        }
      } else {
        setSizeSuggestions(null);
        setShowSizeSuggestions(false);
      }
    };
    loadSizeSuggestions();
  }, [customerName, item.category, item.madeFor]);

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
    if (newType === 'custom') {
      setShowCustomTypeInput(true);
      return;
    }
    
    // Update the items state with the new category value
    const updatedItem = {
      ...item,
      category: newType
    };
    
    // Auto-populate default sizes for the new item type
    const template = getSizeTemplate(newType);
    const newSizes: Record<string, string> = {};
    template.forEach(size => {
      newSizes[size] = item.sizes?.[size] || '';
    });
    updatedItem.sizes = newSizes;
    
    // Update both changes at once
    onUpdate(index, 'completeItem', updatedItem);
    
    // Show success toast for better UX
    toast({
      title: "Item Type Updated",
      description: `Item type changed to ${newType}`,
    });
  };

  const handleAddCustomType = async () => {
    if (!customTypeName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a custom type name",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Save to Firebase
      await addDoc(collection(db, 'customItemTypes'), {
        name: customTypeName.trim(),
        createdAt: serverTimestamp()
      });
      
      // Update local state
      const newTypes = [...itemTypes];
      const insertIndex = newTypes.indexOf('Other') !== -1 ? newTypes.indexOf('Other') : newTypes.length;
      newTypes.splice(insertIndex, 0, customTypeName.trim());
      setItemTypes(newTypes);
      
      // Set as selected type
      onUpdate(index, 'category', customTypeName.trim());
      
      // Auto-populate default sizes
      const template = getSizeTemplate(customTypeName.trim());
      const newSizes: Record<string, string> = {};
      template.forEach(size => {
        newSizes[size] = item.sizes?.[size] || '';
      });
      onUpdate(index, 'sizes', newSizes);
      
      // Reset input and show success
      setCustomTypeName('');
      setShowCustomTypeInput(false);
      
      toast({
        title: "Success",
        description: `Custom type "${customTypeName.trim()}" added successfully`,
      });
    } catch (error) {
      console.error('Error saving custom type:', error);
      toast({
        title: "Error",
        description: "Failed to save custom type. Please try again.",
        variant: "destructive",
      });
    }
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

  const applySizeSuggestions = () => {
    if (sizeSuggestions) {
      const updatedSizes = { ...item.sizes, ...sizeSuggestions };
      onUpdate(index, 'sizes', updatedSizes);
      setShowSizeSuggestions(false);
      toast({
        title: "Sizes Applied",
        description: "Previous measurements have been applied to this item",
      });
    }
  };

  const dismissSizeSuggestions = () => {
    setShowSizeSuggestions(false);
    setSizeSuggestions(null);
  };

  const selectMadeForSuggestion = (madeFor: string) => {
    // Update the madeFor value
    onUpdate(index, 'madeFor', madeFor);
    
    // Hide suggestions after a small delay to allow the update to complete
    setTimeout(() => {
      setShowMadeForSuggestions(false);
    }, 100);
  };

  const handleSaveDesign = (imageUrl: string) => {
    const updatedImages = [...(item.designImages || []), imageUrl];
    onUpdate(index, 'designImages', updatedImages);
    setShowDesignCanvas(false);
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
              <div className="relative">
                <Label htmlFor={`madeFor-${index}`}>Made For</Label>
                <Input
                  id={`madeFor-${index}`}
                  value={item.madeFor}
                  onChange={(e) => {
                    onUpdate(index, 'madeFor', e.target.value);
                    // Only show suggestions if we have value and suggestions exist
                    if (e.target.value.length > 0 && madeForSuggestions.length > 0) {
                      setShowMadeForSuggestions(true);
                    } else {
                      setShowMadeForSuggestions(false);
                    }
                  }}
                  onFocus={(e) => {
                    // Only show suggestions if we have focus and suggestions exist
                    if (madeForSuggestions.length > 0) {
                      setShowMadeForSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Use a longer delay to ensure clicking on suggestions works
                    setTimeout(() => setShowMadeForSuggestions(false), 300);
                  }}
                  placeholder="Customer name"
                />
                
                {/* Made For Suggestions */}
                {showMadeForSuggestions && madeForSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {madeForSuggestions
                      .filter(suggestion => 
                        suggestion.name.toLowerCase().includes(item.madeFor.toLowerCase())
                      )
                      .slice(0, 5)
                      .map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                          onClick={() => selectMadeForSuggestion(suggestion.name)}
                        >
                          <div className="font-medium">{suggestion.name}</div>
                          <div className="text-xs text-gray-500">
                            Used {suggestion.frequency} time{suggestion.frequency !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor={`category-${index}`}>Item Type *</Label>
                {showCustomTypeInput ? (
                  <div className="flex space-x-2">
                    <Input
                      value={customTypeName}
                      onChange={(e) => setCustomTypeName(e.target.value)}
                      placeholder="Enter custom item type"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddCustomType}
                      disabled={!customTypeName.trim()}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowCustomTypeInput(false);
                        setCustomTypeName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-1 w-full">
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={item.category || ''} 
                      onChange={(e) => handleItemTypeChange(e.target.value)}
                    >
                      <option value="">Select item type</option>
                      {itemTypes
                        .filter(type => type !== 'Other' && type !== 'custom')
                        .map((type, typeIndex) => (
                          <option 
                            key={`item-type-${index}-${typeIndex}-${type}`} 
                            value={type}
                          >
                            {type}
                          </option>
                        ))}
                      <option 
                        value="custom"
                        style={{color: '#2563eb', fontWeight: 500}}
                      >
                        + Add Custom Type
                      </option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor={`description-${index}`}>Description</Label>
                <Textarea
                  id={`description-${index}`}
                  value={item.description}
                  onChange={(e) => onUpdate(index, 'description', e.target.value)}
                  placeholder="Brief description"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                <NumberInput
                  id={`quantity-${index}`}
                  value={item.quantity}
                  onChange={(value) => onUpdate(index, 'quantity', value || 1)}
                  min={1}
                  allowEmpty={false}
                  emptyValue={1}
                  placeholder="1"
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
                      <SelectItem key={`status-${option.value}`} value={option.value}>
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
                  value={localDeliveryDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    
                    // Only update if the value has changed to prevent loops
                    if (newDate !== localDeliveryDate) {
                      setLocalDeliveryDate(newDate);
                      onUpdate(index, 'deliveryDate', newDate);
                      
                      // Auto-sync delivery date for subsequent items when Item 1 date is changed
                      if (index === 0 && onDeliveryDateChange) {
                        onDeliveryDateChange(index, newDate);
                      }
                    }
                  }}
                  required
                />
              </div>
            </div>

            {/* Dynamic Size Inputs */}
            {item.category && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Sizes & Measurements</Label>
                  {showSizeSuggestions && sizeSuggestions && (
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={applySizeSuggestions}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        Apply Previous Sizes
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={dismissSizeSuggestions}
                        className="text-gray-500"
                      >
                        ×
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Size suggestion notice */}
                {showSizeSuggestions && sizeSuggestions && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <p className="text-sm text-blue-700">
                        Found previous measurements for <strong>{item.madeFor}</strong> - {item.category}
                      </p>
                    </div>
                    <div className="mt-2 text-xs text-blue-600">
                      {Object.entries(sizeSuggestions).map(([key, value]) => (
                        <span key={key} className="inline-block mr-3">
                          {key}: {value}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
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

            {/* Design Images & Canvas */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-medium">Design Images</Label>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDesignCanvas(true)}
                    className="text-purple-600 hover:bg-purple-50"
                  >
                    <Palette className="h-4 w-4 mr-1" />
                    Professional Design Tool
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      // File upload functionality with Cloudinary integration
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.multiple = true;
                      input.onchange = async (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files && files.length > 0) {
                          try {
                            toast({
                              title: "Uploading...",
                              description: `Uploading ${files.length} image(s)...`,
                            });
                            
                            const uploadedUrls = await uploadMultipleToCloudinary(files);
                            const updatedImages = [...(item.designImages || []), ...uploadedUrls];
                            onUpdate(index, 'designImages', updatedImages);
                            
                            toast({
                              title: "Success",
                              description: `${uploadedUrls.length} image(s) uploaded successfully`,
                            });
                          } catch (error) {
                            console.error('Upload error:', error);
                            toast({
                              title: "Error",
                              description: "Failed to upload images. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }
                      };
                      input.click();
                    }}
                    className="text-blue-600 hover:bg-blue-50"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload
                  </Button>
                </div>
              </div>
              
              <div className="min-h-[100px] border-2 border-dashed border-gray-200 rounded-lg p-4">
                {item.designImages && item.designImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {item.designImages.map((image, imgIndex) => (
                      <div key={imgIndex} className="relative group">
                        <img
                          src={image}
                          alt={`Design ${imgIndex + 1}`}
                          className="w-full h-20 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            const updatedImages = item.designImages.filter((_, i) => i !== imgIndex);
                            onUpdate(index, 'designImages', updatedImages);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">
                      <Palette className="h-8 w-8 mx-auto" />
                    </div>
                    <p className="text-sm text-gray-500">No design images yet</p>
                    <p className="text-xs text-gray-400 mt-1">Use Design Canvas or Upload images</p>
                  </div>
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
      
      {/* Professional Design Canvas Modal */}
      <ToolDesignCanvas
        isOpen={showDesignCanvas}
        onClose={() => setShowDesignCanvas(false)}
        onSave={handleSaveDesign}
        orderId={orderId || `temp-order-${customerName?.replace(/\s+/g, '-') || 'unknown'}-${Date.now()}`}
        itemIndex={index}
        initialDesignData={item.designImages?.[0] ? { backgroundImage: item.designImages[0] } : undefined}
      />
    </Collapsible>
  );
};

export default OrderItemCard;
