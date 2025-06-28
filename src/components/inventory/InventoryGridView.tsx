
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus, Edit, Trash2, Barcode } from 'lucide-react';
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {items.map((item) => (
        <Card key={item.id} className="border hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Barcode */}
              {item.barcodeURL && (
                <div className="flex justify-center">
                  <img src={item.barcodeURL} alt="Barcode" className="w-24 h-12" />
                </div>
              )}
              
              {/* Item Info */}
              <div>
                <h3 className="font-semibold text-lg truncate">{item.name}</h3>
                <p className="text-sm text-gray-600">{item.category} • {item.type}</p>
                <p className="text-xs text-gray-500">{item.location}</p>
              </div>
              
              {/* Stock Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStockAdjustment(item.id, -1)}
                    disabled={item.quantity <= 0}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="font-medium text-sm">{item.quantity} {item.unit}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStockAdjustment(item.id, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Badge 
                  variant={
                    (item.quantity || 0) <= (item.reorderLevel || 0) ? "destructive" :
                    (item.quantity || 0) <= ((item.reorderLevel || 0) * 2) ? "outline" : "outline"
                  }
                  className={
                    (item.quantity || 0) <= (item.reorderLevel || 0) ? "" :
                    (item.quantity || 0) <= ((item.reorderLevel || 0) * 2) ? "text-orange-600 border-orange-200" : "text-green-600 border-green-200"
                  }
                >
                  {(item.quantity || 0) <= (item.reorderLevel || 0) ? "Reorder" :
                   (item.quantity || 0) <= ((item.reorderLevel || 0) * 2) ? "Low" : "Good"}
                </Badge>
              </div>
              
              {/* Price Info */}
              <div className="text-center">
                <p className="font-semibold text-lg">₹{(item.totalValue || 0).toLocaleString()}</p>
                <p className="text-sm text-gray-600">₹{(item.costPerUnit || 0).toFixed(2)}/unit</p>
              </div>
              
              {/* Supplier */}
              <div className="text-center">
                <p className="text-sm font-medium">{item.supplier?.name}</p>
                <div className="flex items-center justify-center space-x-2 mt-1">
                  <p className="text-xs text-gray-600">{item.supplier?.phone}</p>
                  {item.supplier?.phone && (
                    <ContactActions 
                      phone={item.supplier.phone}
                      message={`Hi, I need to reorder ${item.name}. Current stock: ${item.quantity} ${item.unit}`}
                    />
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex space-x-2 justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onGenerateBarcode(item.id, item.name)}
                  disabled={!!item.barcodeURL}
                  title="Generate Barcode"
                >
                  <Barcode className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(item)}
                  title="Edit Item"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(item.id)}
                  className="text-red-600 hover:text-red-700"
                  title="Delete Item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default InventoryGridView;
