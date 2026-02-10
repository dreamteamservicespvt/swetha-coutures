
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Minus, Edit, Trash2, Barcode, Package2, TrendingUp, AlertTriangle, MapPin, X } from 'lucide-react';
import ContactActions from '@/components/ContactActions';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  type: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalValue: number;
  reorderLevel: number;
  supplier: {
    name: string;
    phone: string;
    email?: string;
  };
  location: string;
  notes?: string;
  barcodeURL?: string;
  barcodeValue?: string;
}

interface InventoryGridViewProps {
  items: InventoryItem[];
  onStockAdjustment: (itemId: string, adjustment: number) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (itemId: string) => void;
  onGenerateBarcode: (itemId: string, itemName: string) => void;
}

const InventoryGridView: React.FC<InventoryGridViewProps> = ({
  items,
  onStockAdjustment,
  onEdit,
  onDelete,
  onGenerateBarcode
}) => {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const getStockStatus = (quantity: number, reorderLevel: number) => {
    if (quantity <= reorderLevel) return { status: 'critical', color: 'destructive', label: 'Reorder', icon: AlertTriangle };
    if (quantity <= reorderLevel * 2) return { status: 'warning', color: 'secondary', label: 'Low Stock', icon: TrendingUp };
    return { status: 'good', color: 'default', label: 'Good Stock', icon: Package2 };
  };

  const openDetails = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsDetailsOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => {
          const stockInfo = getStockStatus(item.quantity || 0, item.reorderLevel || 0);
          const StatusIcon = stockInfo.icon;
          
          return (
            <Card 
              key={item.id} 
              className="group hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden"
              onClick={() => openDetails(item)}
            >
              <CardContent className="p-4">
                {/* Header with name and stock badge */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-base truncate flex-1 pr-2 group-hover:text-primary transition-colors">
                    {item.name}
                  </h3>
                  <Badge 
                    variant={stockInfo.color as any}
                    className="shrink-0 text-xs"
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {stockInfo.label}
                  </Badge>
                </div>

                {/* Price and Stock info */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Cost:</span>
                    <span className="font-bold text-primary">₹{item.costPerUnit?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Stock:</span>
                    <span className="font-semibold">{item.quantity} {item.unit}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(item);
                    }}
                    className="flex-1 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className="flex-1 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Details Dialog */}
      {selectedItem && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{selectedItem.name}</span>
                <Badge 
                  variant={getStockStatus(selectedItem.quantity, selectedItem.reorderLevel).color as any}
                  className="text-xs"
                >
                  {getStockStatus(selectedItem.quantity, selectedItem.reorderLevel).label}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Category</label>
                  <p className="font-medium">{selectedItem.category}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Type</label>
                  <p className="font-medium">{selectedItem.type}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Location</label>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedItem.location}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Unit</label>
                  <p className="font-medium">{selectedItem.unit}</p>
                </div>
              </div>

              {/* Barcode */}
              {(selectedItem.barcodeURL || selectedItem.barcodeValue) && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 border-2 border-dashed border-purple-300 dark:border-purple-600">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Barcode className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <label className="text-sm font-medium">Item Barcode</label>
                    </div>
                    <Badge variant="secondary" className="text-xs">Scannable</Badge>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-900 rounded-lg p-4">
                    {selectedItem.barcodeURL && (
                      <img src={selectedItem.barcodeURL} alt="Barcode" className="h-24 object-contain" />
                    )}
                    {selectedItem.barcodeValue && (
                      <p className="text-sm font-mono text-gray-600 dark:text-gray-400 mt-3">{selectedItem.barcodeValue}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Stock Adjustment */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4">
                <label className="text-sm font-medium mb-3 block">Stock Adjustment</label>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStockAdjustment(selectedItem.id, -1)}
                    disabled={selectedItem.quantity <= 0}
                    className="h-10 w-10 p-0 rounded-full hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="text-center min-w-[100px]">
                    <div className="text-3xl font-bold">{selectedItem.quantity}</div>
                    <div className="text-sm text-muted-foreground">{selectedItem.unit}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStockAdjustment(selectedItem.id, 1)}
                    className="h-10 w-10 p-0 rounded-full hover:bg-green-50 hover:border-green-200 hover:text-green-600"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Price Information */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Unit Cost:</span>
                  <span className="text-lg font-semibold">₹{selectedItem.costPerUnit?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Value:</span>
                  <span className="text-xl font-bold text-primary">₹{selectedItem.totalValue?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-muted-foreground">Reorder Level:</span>
                  <span className="font-medium">{selectedItem.reorderLevel || 0} {selectedItem.unit}</span>
                </div>
              </div>

              {/* Supplier Information */}
              <div className="border rounded-lg p-4 space-y-3">
                <label className="text-sm font-medium">Supplier Information</label>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedItem.supplier?.name || 'No supplier'}</p>
                    <p className="text-sm text-muted-foreground">{selectedItem.supplier?.phone}</p>
                    {selectedItem.supplier?.email && (
                      <p className="text-sm text-muted-foreground">{selectedItem.supplier.email}</p>
                    )}
                  </div>
                  {selectedItem.supplier?.phone && (
                    <ContactActions 
                      phone={selectedItem.supplier.phone}
                      message={`Hi ${selectedItem.supplier.name}, I would like to inquire about ${selectedItem.name} availability.`}
                    />
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedItem.notes && (
                <div className="border rounded-lg p-4">
                  <label className="text-sm font-medium">Notes</label>
                  <p className="text-sm text-muted-foreground mt-2">{selectedItem.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    onEdit(selectedItem);
                    setIsDetailsOpen(false);
                  }}
                  className="flex-1 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Item
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onGenerateBarcode(selectedItem.id, selectedItem.name);
                  }}
                  className="hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600"
                  title="Generate Barcode"
                >
                  <Barcode className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onDelete(selectedItem.id);
                    setIsDetailsOpen(false);
                  }}
                  className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                  title="Delete Item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default InventoryGridView;
