
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Minus, Edit, Trash2, Barcode, Package2, TrendingUp, AlertTriangle, MapPin } from 'lucide-react';
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
  const getStockStatus = (quantity: number, reorderLevel: number) => {
    if (quantity <= reorderLevel) return { status: 'critical', color: 'destructive', label: 'Reorder', icon: AlertTriangle };
    if (quantity <= reorderLevel * 2) return { status: 'warning', color: 'secondary', label: 'Low Stock', icon: TrendingUp };
    return { status: 'good', color: 'default', label: 'Good Stock', icon: Package2 };
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {items.map((item) => {
        const stockInfo = getStockStatus(item.quantity || 0, item.reorderLevel || 0);
        const StatusIcon = stockInfo.icon;
        
        return (
          <Card key={item.id} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/20 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <CardTitle className="text-lg font-bold truncate group-hover:text-primary transition-colors">
                    {item.name}
                  </CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{item.category}</Badge>
                    <span>•</span>
                    <span className="truncate">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{item.location}</span>
                  </div>
                </div>
                <Badge 
                  variant={stockInfo.color as any}
                  className="shrink-0 text-xs font-medium"
                >
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {stockInfo.label}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Barcode */}
              {item.barcodeURL && (
                <div className="flex justify-center p-2 bg-white dark:bg-gray-800 rounded-lg border">
                  <img src={item.barcodeURL} alt="Barcode" className="w-20 h-10 object-contain" />
                </div>
              )}
              
              {/* Stock Adjustment */}
              <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStockAdjustment(item.id, -1)}
                    disabled={item.quantity <= 0}
                    className="h-8 w-8 p-0 rounded-full hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="text-center">
                    <div className="text-xl font-bold">{item.quantity}</div>
                    <div className="text-xs text-muted-foreground">{item.unit}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStockAdjustment(item.id, 1)}
                    className="h-8 w-8 p-0 rounded-full hover:bg-green-50 hover:border-green-200 hover:text-green-600"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Price Information */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Unit Cost:</span>
                  <span className="font-semibold">₹{item.costPerUnit?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Value:</span>
                  <span className="font-bold text-primary">₹{item.totalValue?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Reorder at:</span>
                  <span>{item.reorderLevel || 0} {item.unit}</span>
                </div>
              </div>
              
              {/* Supplier Information */}
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Supplier:</span>
                  <ContactActions 
                    phone={item.supplier?.phone}
                    message={`Hi ${item.supplier?.name}, I would like to inquire about ${item.name} availability.`}
                  />
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {item.supplier?.name || 'No supplier'}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(item)}
                  className="flex-1 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onGenerateBarcode(item.id, item.name)}
                  className="hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600"
                  title="Generate Barcode"
                >
                  <Barcode className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(item.id)}
                  className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                  title="Delete Item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default InventoryGridView;
