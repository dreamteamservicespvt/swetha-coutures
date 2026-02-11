import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Minus, Edit, Trash2, Barcode } from 'lucide-react';
import ContactActions from '@/components/ContactActions';
import BarcodeDisplay from '@/components/BarcodeDisplay';

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

interface InventoryTableViewProps {
  items: InventoryItem[];
  onStockAdjustment: (itemId: string, adjustment: number) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (itemId: string) => void;
  onGenerateBarcode: (itemId: string, itemName: string) => void;
}

const InventoryTableView: React.FC<InventoryTableViewProps> = ({
  items,
  onStockAdjustment,
  onEdit,
  onDelete,
  onGenerateBarcode
}) => {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <div className="table-horizontal-scroll">
          <Table className="table-dark-fix">
            <TableHeader>
              <TableRow>
                <TableHead className="text-dark-fix">Item</TableHead>
                <TableHead className="text-dark-fix">Category</TableHead>
                <TableHead className="text-dark-fix">Type</TableHead>
                <TableHead className="text-dark-fix">Quantity</TableHead>
                <TableHead className="text-dark-fix">Unit Cost</TableHead>
                <TableHead className="text-dark-fix">Total Value</TableHead>
                <TableHead className="text-dark-fix">Supplier</TableHead>
                <TableHead className="text-dark-fix">Status</TableHead>
                <TableHead className="text-dark-fix">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <TableCell className="table-cell-responsive">
                    <div>
                      <div className="font-medium text-dark-fix">{item.name || 'N/A'}</div>
                      <div className="text-sm text-muted-dark-fix">{item.location || 'N/A'}</div>
                      {item.barcodeValue && (
                        <BarcodeDisplay value={item.barcodeValue} width={1} height={30} showText={false} className="w-20 h-8 mt-1" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-dark-fix">{item.category || 'N/A'}</TableCell>
                  <TableCell className="text-dark-fix">{item.type || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onStockAdjustment(item.id, -1)}
                        disabled={item.quantity <= 0}
                        className="button-dark-fix"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-medium text-dark-fix min-w-[4rem] text-center">{item.quantity || 0} {item.unit || 'units'}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onStockAdjustment(item.id, 1)}
                        className="button-dark-fix"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {(item.quantity || 0) <= (item.reorderLevel || 0) && (
                      <Badge variant="destructive" className="text-xs mt-1">Low Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-dark-fix">₹{(item.costPerUnit || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-dark-fix">₹{(item.totalValue || 0).toLocaleString()}</TableCell>
                  <TableCell className="table-cell-responsive">
                    <div className="flex items-center space-x-2">
                      <div>
                        <div className="font-medium text-dark-fix">{item.supplier?.name || 'N/A'}</div>
                        <div className="text-sm text-muted-dark-fix">{item.supplier?.phone || 'No phone'}</div>
                      </div>
                      {item.supplier?.phone && (
                        <ContactActions 
                          phone={item.supplier.phone}
                          message={`Hi, regarding ${item.name} supply. Current stock: ${item.quantity || 0} ${item.unit || 'units'}.`}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(item.quantity || 0) <= (item.reorderLevel || 0) ? (
                      <Badge variant="destructive" className="badge-dark-fix">Low Stock</Badge>
                    ) : (item.quantity || 0) < (item.reorderLevel || 0) * 2 ? (
                      <Badge variant="secondary" className="badge-dark-fix bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Medium</Badge>
                    ) : (
                      <Badge variant="default" className="badge-dark-fix bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">In Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(item)}
                        className="button-dark-fix"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGenerateBarcode(item.id, item.name)}
                        className="button-dark-fix"
                      >
                        <Barcode className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete(item.id)}
                        className="button-dark-fix text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="table-scroll-hint">
            
          </div>
        </div>
      </div>

      {/* Tablet Horizontal Scroll View */}
      <div className="hidden md:block lg:hidden">
        <div className="table-horizontal-scroll">
          <Table className="table-dark-fix">
            <TableHeader>
              <TableRow>
                <TableHead className="text-dark-fix">Item</TableHead>
                <TableHead className="text-dark-fix">Category</TableHead>
                <TableHead className="text-dark-fix">Quantity</TableHead>
                <TableHead className="text-dark-fix">Unit Cost</TableHead>
                <TableHead className="text-dark-fix">Status</TableHead>
                <TableHead className="text-dark-fix">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <TableCell>
                    <div>
                      <div className="font-medium text-dark-fix">{item.name || 'N/A'}</div>
                      <div className="text-sm text-muted-dark-fix">{item.location || 'N/A'}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-dark-fix">{item.category || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onStockAdjustment(item.id, -1)}
                        disabled={item.quantity <= 0}
                        className="h-6 w-6 p-0 button-dark-fix"
                      >
                        <Minus className="h-2 w-2" />
                      </Button>
                      <span className="font-medium text-dark-fix text-xs px-1">{item.quantity || 0}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onStockAdjustment(item.id, 1)}
                        className="h-6 w-6 p-0 button-dark-fix"
                      >
                        <Plus className="h-2 w-2" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-dark-fix text-sm">₹{(item.costPerUnit || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    {(item.quantity || 0) <= (item.reorderLevel || 0) ? (
                      <Badge variant="destructive" className="text-xs">Low</Badge>
                    ) : (
                      <Badge variant="default" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(item)}
                        className="h-6 w-6 p-0 button-dark-fix"
                      >
                        <Edit className="h-2 w-2" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete(item.id)}
                        className="h-6 w-6 p-0 button-dark-fix text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="h-2 w-2" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="table-scroll-hint">
            
          </div>
        </div>
      </div>
    </>
  );
};

export default InventoryTableView;
