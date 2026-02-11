
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Edit, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  CheckCircle,
  Phone,
  MessageCircle
} from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  minStock: number;
  supplier?: string;
  supplierPhone?: string;
  description?: string;
  location?: string;
  createdAt?: any;
}

interface InventoryMobileCardProps {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onSupplierCall?: (phone: string, itemName: string) => void;
  onSupplierWhatsApp?: (phone: string, itemName: string, currentStock: number) => void;
}

const InventoryMobileCard = ({
  item,
  onEdit,
  onDelete,
  onSupplierCall,
  onSupplierWhatsApp
}: InventoryMobileCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const isLowStock = item.quantity <= item.minStock;
  const stockStatus = isLowStock ? 'low' : 'good';

  const handleSupplierCall = () => {
    if (item.supplierPhone && onSupplierCall) {
      onSupplierCall(item.supplierPhone, item.name);
    }
  };

  const handleSupplierWhatsApp = () => {
    if (item.supplierPhone && onSupplierWhatsApp) {
      onSupplierWhatsApp(item.supplierPhone, item.name, item.quantity);
    }
  };

  return (
    <Card className={`border-0 shadow-md ${isLowStock ? 'ring-2 ring-red-200 bg-red-50' : 'bg-white dark:bg-gray-900'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Package className={`h-5 w-5 ${isLowStock ? 'text-red-600' : 'text-blue-600'}`} />
              <span className="truncate">{item.name}</span>
            </CardTitle>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {item.category}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {item.type}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="ml-2"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stock Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isLowStock ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <span className="text-sm font-medium">
              {item.quantity} {item.unit}
            </span>
          </div>
          <Badge 
            variant={isLowStock ? "destructive" : "default"}
            className="text-xs"
          >
            {isLowStock ? 'Low Stock' : 'In Stock'}
          </Badge>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Unit Cost:</span>
            <p className="font-medium">₹{item.unitCost?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Min Stock:</span>
            <p className="font-medium">{item.minStock} {item.unit}</p>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {item.supplier && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Supplier:</span>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{item.supplier}</p>
                  {item.supplierPhone && (
                    <div className="flex space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSupplierCall}
                        className="h-8 w-8 p-0"
                      >
                        <Phone className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSupplierWhatsApp}
                        className="h-8 w-8 p-0"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {item.location && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Location:</span>
                <p className="font-medium">{item.location}</p>
              </div>
            )}

            {item.description && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Description:</span>
                <p className="text-sm text-gray-800 dark:text-gray-200">{item.description}</p>
              </div>
            )}

            <div className="flex space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(item.id)}
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryMobileCard;
