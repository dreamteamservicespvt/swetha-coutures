import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Package,
  Filter,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface StaffInventoryItem {
  id: string;
  name: string;
  category: string;
  type: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  location?: string;
  notes?: string;
  // Deliberately exclude: costPerUnit, totalValue, supplier info
}

const StaffInventoryView = () => {
  const { userData } = useAuth();
  const [items, setItems] = useState<StaffInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      
      const itemsQuery = query(
        collection(db, 'inventory'),
        orderBy('name', 'asc')
      );
      
      const itemsSnapshot = await getDocs(itemsQuery);
      const itemsData = itemsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          category: data.category,
          type: data.type,
          quantity: data.quantity || 0,
          unit: data.unit,
          reorderLevel: data.reorderLevel || 0,
          location: data.location,
          notes: data.notes
          // Exclude sensitive information like cost, supplier details, etc.
        };
      }) as StaffInventoryItem[];

      setItems(itemsData);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (item: StaffInventoryItem) => {
    if (item.quantity === 0) return { status: 'out-of-stock', color: 'bg-red-100 text-red-700' };
    if (item.quantity <= item.reorderLevel) return { status: 'low-stock', color: 'bg-yellow-100 text-yellow-700' };
    return { status: 'in-stock', color: 'bg-green-100 text-green-700' };
  };

  const getUniqueCategories = () => {
    return [...new Set(items.map(item => item.category))].filter(Boolean);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    
    const stockStatus = getStockStatus(item);
    const matchesStock = stockFilter === 'all' || 
                        (stockFilter === 'in-stock' && stockStatus.status === 'in-stock') ||
                        (stockFilter === 'low-stock' && stockStatus.status === 'low-stock') ||
                        (stockFilter === 'out-of-stock' && stockStatus.status === 'out-of-stock');
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Inventory Overview</h1>
        <p className="text-white/90">
          View available materials and supplies
        </p>
        <div className="mt-4 text-sm text-white/80">
          <p>ℹ️ Note: This is a read-only view. Contact admin for inventory updates or cost information.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold">{items.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Stock</p>
                <p className="text-2xl font-bold">
                  {items.filter(item => getStockStatus(item).status === 'in-stock').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold">
                  {items.filter(item => getStockStatus(item).status === 'low-stock').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold">
                  {items.filter(item => getStockStatus(item).status === 'out-of-stock').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Items</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, category, or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {getUniqueCategories().map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Stock Status</label>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by stock status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low-stock">Low Stock</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <div className="space-y-4">
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const stockStatus = getStockStatus(item);
              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      <Badge className={stockStatus.color}>
                        {stockStatus.status.replace('-', ' ')}
                      </Badge>
                    </div>
                    <CardDescription>{item.category} - {item.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Available Quantity</label>
                          <p className="text-lg font-bold">
                            {item.quantity} {item.unit}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Reorder Level</label>
                          <p className="text-sm text-gray-700">
                            {item.reorderLevel} {item.unit}
                          </p>
                        </div>
                      </div>
                      
                      {item.location && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Location</label>
                          <p className="text-sm text-gray-700">{item.location}</p>
                        </div>
                      )}
                      
                      {item.notes && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Notes</label>
                          <p className="text-sm text-gray-700">{item.notes}</p>
                        </div>
                      )}
                      
                      {/* Progress bar for stock level */}
                      <div>
                        <label className="text-sm font-medium text-gray-600">Stock Level</label>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${
                              stockStatus.status === 'out-of-stock' ? 'bg-red-500' :
                              stockStatus.status === 'low-stock' ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ 
                              width: `${Math.min((item.quantity / (item.reorderLevel * 2)) * 100, 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Items Found</h3>
              <p className="text-gray-500">
                {searchTerm || categoryFilter !== 'all' || stockFilter !== 'all'
                  ? 'No items match your current filters.' 
                  : 'No inventory items available.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StaffInventoryView;
