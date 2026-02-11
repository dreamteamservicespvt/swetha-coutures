
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Package, AlertTriangle, Star, Trash2, Calendar, Minus, Barcode, Edit, Download, Printer, RefreshCw, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import jsPDF from 'jspdf';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { generateBarcodeValue } from '@/utils/barcodeUtils';
import BarcodeDisplay from '@/components/BarcodeDisplay';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Import refactored components
import InventoryStats from '@/components/inventory/InventoryStats';
import InventoryDateFilters from '@/components/inventory/InventoryDateFilters';
import InventorySearchFilters from '@/components/inventory/InventorySearchFilters';
import InventoryTableView from '@/components/inventory/InventoryTableView';
import InventoryGridView from '@/components/inventory/InventoryGridView';
import ContactActions from '@/components/ContactActions';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  type: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  sellingPrice?: number; // Selling price to customers (if not set, use costPerUnit * markup)
  totalValue: number;
  reorderLevel: number;
  supplier: {
    name: string;
    phone: string;
    email?: string;
  };
  location: string;
  notes?: string;
  lastUpdated: any;
  createdAt: any;
  broughtAt?: any;
  usedAt?: any;
  barcodeURL?: string;
  barcodeValue?: string;
  usageCount?: number;
}

interface InventoryType {
  id: string;
  name: string;
  usageCount?: number;
  createdAt: any;
}

interface InventoryCategory {
  id: string;
  name: string;
  usageCount?: number;
  createdAt: any;
}

const Inventory = () => {
  const { userData } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [types, setTypes] = useState<InventoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTypeManagerOpen, setIsTypeManagerOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Date filter states
  const [dateFilterMode, setDateFilterMode] = useState<'single' | 'range'>('single');
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [dateField, setDateField] = useState<'broughtAt' | 'usedAt' | 'createdAt'>('createdAt');

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    type: '',
    quantity: '',
    unit: 'pieces',
    costPerUnit: '',
    reorderLevel: '',
    supplierName: '',
    supplierPhone: '',
    supplierEmail: '',
    location: '',
    notes: '',
    broughtAt: new Date(),
    usedAt: undefined as Date | undefined
  });

  const [newType, setNewType] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [isAddingNewType, setIsAddingNewType] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState('');

  const units = ['pieces', 'meters', 'yards', 'kg', 'grams', 'rolls', 'sets'];

  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [userData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchItems(),
        fetchCategories(),
        fetchTypes()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      let itemsQuery = query(
        collection(db, 'inventory'),
        orderBy('createdAt', 'desc')
      );

      // Apply date filters
      if (dateFilterMode === 'single' && singleDate) {
        const startOfDay = new Date(singleDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(singleDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        itemsQuery = query(
          collection(db, 'inventory'),
          where(dateField, '>=', Timestamp.fromDate(startOfDay)),
          where(dateField, '<=', Timestamp.fromDate(endOfDay)),
          orderBy(dateField, 'desc')
        );
      } else if (dateFilterMode === 'range' && startDate && endDate) {
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        itemsQuery = query(
          collection(db, 'inventory'),
          where(dateField, '>=', Timestamp.fromDate(startOfDay)),
          where(dateField, '<=', Timestamp.fromDate(endOfDay)),
          orderBy(dateField, 'desc')
        );
      }

      const itemsSnapshot = await getDocs(itemsQuery);
      const itemsData = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      
      setItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      setItems([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const categoriesQuery = query(
        collection(db, 'inventoryCategories'),
        orderBy('name', 'asc')
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryCategory[];
      
      // Remove duplicates based on category name (keep first occurrence)
      const uniqueCategories = categoriesData.filter((cat, index, self) => 
        index === self.findIndex(c => c.name.toLowerCase() === cat.name.toLowerCase())
      );
      
      setCategories(uniqueCategories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const fetchTypes = async () => {
    try {
      const typesQuery = query(
        collection(db, 'inventoryTypes'),
        orderBy('name', 'asc')
      );
      const typesSnapshot = await getDocs(typesQuery);
      const typesData = typesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryType[];
      
      // Remove duplicates based on type name (keep first occurrence)
      const uniqueTypes = typesData.filter((type, index, self) => 
        index === self.findIndex(t => t.name.toLowerCase() === type.name.toLowerCase())
      );
      
      setTypes(uniqueTypes || []);
    } catch (error) {
      console.error('Error fetching types:', error);
      setTypes([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Add new category if user is creating one
      if (isAddingNewCategory && newCategory.trim()) {
        // Check if category already exists
        const existingCategory = categories.find(
          cat => cat.name.toLowerCase() === newCategory.trim().toLowerCase()
        );
        if (!existingCategory) {
          await addDoc(collection(db, 'inventoryCategories'), {
            name: newCategory.trim(),
            usageCount: 0,
            createdAt: serverTimestamp()
          });
          await fetchCategories();
        }
      }

      // Add new type if user is creating one
      if (isAddingNewType && newType.trim()) {
        // Check if type already exists
        const existingType = types.find(
          t => t.name.toLowerCase() === newType.trim().toLowerCase()
        );
        if (!existingType) {
          await addDoc(collection(db, 'inventoryTypes'), {
            name: newType.trim(),
            usageCount: 0,
            createdAt: serverTimestamp()
          });
          await fetchTypes();
        }
      }

      const quantity = parseFloat(formData.quantity) || 0;
      const costPerUnit = parseFloat(formData.costPerUnit) || 0;
      const totalValue = quantity * costPerUnit; // This will always be a valid number
      
      const itemData: any = {
        name: formData.name,
        category: formData.category,
        type: formData.type,
        quantity,
        unit: formData.unit,
        costPerUnit,
        totalValue,
        reorderLevel: parseFloat(formData.reorderLevel) || 0,
        supplier: {
          name: formData.supplierName,
          phone: formData.supplierPhone,
          ...(formData.supplierEmail && { email: formData.supplierEmail })
        },
        location: formData.location,
        notes: formData.notes,
        broughtAt: Timestamp.fromDate(formData.broughtAt),
        ...(formData.usedAt && { usedAt: Timestamp.fromDate(formData.usedAt) }),
        lastUpdated: serverTimestamp(),
        ...(editingItem ? {} : { createdAt: serverTimestamp() })
      };

      // Always save barcodeValue — this is what the scanner matches against
      if (barcodeValue) {
        itemData.barcodeValue = barcodeValue;
      }

      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), itemData);
        toast({
          title: "Success",
          description: "Item updated successfully",
        });
      } else {
        await addDoc(collection(db, 'inventory'), itemData);
        toast({
          title: "Success",
          description: "Item added successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingItem(null);
      resetForm();
      fetchItems();
    } catch (error) {
      console.error('Error saving item:', error);
      toast({
        title: "Error",
        description: "Failed to save item",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      type: '',
      quantity: '',
      unit: 'pieces',
      costPerUnit: '',
      reorderLevel: '',
      supplierName: '',
      supplierPhone: '',
      supplierEmail: '',
      location: '',
      notes: '',
      broughtAt: new Date(),
      usedAt: undefined
    });
    setIsAddingNewCategory(false);
    setIsAddingNewType(false);
    setNewCategory('');
    setNewType('');
    setBarcodeValue('');
  };

  // Auto-generate barcode value when item name changes
  useEffect(() => {
    if (formData.name.trim() && !barcodeValue) {
      setBarcodeValue(generateBarcodeValue(formData.name));
    } else if (!formData.name.trim()) {
      setBarcodeValue('');
    }
  }, [formData.name]);

  // Regenerate barcode with new value
  const regenerateBarcode = () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Please enter an item name first', variant: 'destructive' });
      return;
    }
    setBarcodeValue(generateBarcodeValue(formData.name));
    toast({ title: 'Success', description: 'Barcode regenerated' });
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      category: item.category || '',
      type: item.type || '',
      quantity: item.quantity?.toString() || '',
      unit: item.unit || 'pieces',
      costPerUnit: item.costPerUnit?.toString() || '',
      reorderLevel: item.reorderLevel?.toString() || '',
      supplierName: item.supplier?.name || '',
      supplierPhone: item.supplier?.phone || '',
      supplierEmail: item.supplier?.email || '',
      location: item.location || '',
      notes: item.notes || '',
      broughtAt: item.broughtAt?.toDate() || new Date(),
      usedAt: item.usedAt?.toDate() || undefined
    });
    setIsAddingNewCategory(false);
    setIsAddingNewType(false);
    setNewCategory('');
    setNewType('');
    // Set existing barcode value if available
    if (item.barcodeValue) {
      setBarcodeValue(item.barcodeValue);
    }
    setIsDialogOpen(true);
  };

  const handleDelete = async (itemId: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteDoc(doc(db, 'inventory', itemId));
        toast({
          title: "Success",
          description: "Item deleted successfully",
        });
        fetchItems();
      } catch (error) {
        console.error('Error deleting item:', error);
        toast({
          title: "Error",
          description: "Failed to delete item",
          variant: "destructive",
        });
      }
    }
  };

  const handleStockAdjustment = async (itemId: string, adjustment: number) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const newQuantity = Math.max(0, item.quantity + adjustment);
      const safeCostPerUnit = item.costPerUnit || 0; // Ensure costPerUnit is not undefined
      const newTotalValue = newQuantity * safeCostPerUnit;

      await updateDoc(doc(db, 'inventory', itemId), {
        quantity: newQuantity,
        totalValue: newTotalValue,
        lastUpdated: serverTimestamp()
      });

      toast({
        title: "Stock Updated",
        description: `Quantity ${adjustment > 0 ? 'increased' : 'decreased'} by ${Math.abs(adjustment)}`,
      });

      fetchItems();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast({
        title: "Error",
        description: "Failed to adjust stock",
        variant: "destructive",
      });
    }
  };

  const generateItemBarcode = async (itemId: string, itemName: string) => {
    try {
      const barcodeVal = generateBarcodeValue(itemName);
      
      // Save barcode value to Firestore — BarcodeDisplay component handles rendering
      await updateDoc(doc(db, 'inventory', itemId), {
        barcodeValue: barcodeVal,
        lastUpdated: serverTimestamp()
      });

      toast({
        title: "Barcode Generated",
        description: `Scannable barcode generated for ${itemName}`,
      });

      fetchItems();
    } catch (error) {
      console.error('Error generating barcode:', error);
      toast({
        title: "Error",
        description: "Failed to generate barcode",
        variant: "destructive",
      });
    }
  };

  const clearDateFilters = () => {
    setSingleDate(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
    fetchItems();
  };

  const handleAddType = async () => {
    if (!newType.trim()) return;

    try {
      await addDoc(collection(db, 'inventoryTypes'), {
        name: newType.trim(),
        usageCount: 0,
        createdAt: serverTimestamp()
      });

      toast({
        title: "Success",
        description: "Type added successfully",
      });

      setNewType('');
      fetchTypes();
    } catch (error) {
      console.error('Error adding type:', error);
      toast({
        title: "Error",
        description: "Failed to add type",
        variant: "destructive",
      });
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;

    try {
      await addDoc(collection(db, 'inventoryCategories'), {
        name: newCategory.trim(),
        usageCount: 0,
        createdAt: serverTimestamp()
      });

      toast({
        title: "Success",
        description: "Category added successfully",
      });

      setNewCategory('');
      fetchCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      toast({
        title: "Error",
        description: "Failed to add category",
        variant: "destructive",
      });
    }
  };

  const handleDeleteType = async (typeId: string) => {
    if (window.confirm('Are you sure you want to delete this type?')) {
      try {
        await deleteDoc(doc(db, 'inventoryTypes', typeId));
        toast({
          title: "Success",
          description: "Type deleted successfully",
        });
        fetchTypes();
      } catch (error) {
        console.error('Error deleting type:', error);
        toast({
          title: "Error",
          description: "Failed to delete type",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        await deleteDoc(doc(db, 'inventoryCategories', categoryId));
        toast({
          title: "Success",
          description: "Category deleted successfully",
        });
        fetchCategories();
      } catch (error) {
        console.error('Error deleting category:', error);
        toast({
          title: "Error",
          description: "Failed to delete category",
          variant: "destructive",
        });
      }
    }
  };

  const toggleItemExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  if (!userData) {
    return <LoadingSpinner type="page" />;
  }

  if (loading) {
    return <LoadingSpinner type="page" />;
  }

  // Apply filters
  const filteredItems = items.filter(item => {
    if (!item) return false;
    
    const matchesSearch = (
      (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.supplier?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  // Get top 5 categories and types for "Mostly Used" filters
  const mostUsedCategories = categories
    .filter(cat => cat?.usageCount && cat.usageCount > 0)
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    .slice(0, 5);

  const mostUsedTypes = types
    .filter(type => type?.usageCount && type.usageCount > 0)
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    .slice(0, 5);

  // Safe calculations with proper null checks
  const lowStockItems = items.filter(item => 
    (item?.quantity || 0) <= (item?.reorderLevel || 0)
  );
  const totalValue = items.reduce((sum, item) => 
    sum + ((item?.totalValue || 0)), 0
  );
  const totalItems = items.reduce((sum, item) => 
    sum + (item?.quantity || 0), 0
  );

  return (
    <div className="mobile-page-layout">
      <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="mobile-page-header">
          <div className="space-y-1 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-dark-fix">Inventory Management</h1>
            <p className="responsive-text-base text-muted-dark-fix">Track materials, fabrics, and supplies</p>
          </div>
        <div className="responsive-actions">
          <Button 
            variant="outline"
            onClick={() => setIsCategoryManagerOpen(true)}
            className="btn-responsive bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Manage Categories
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsTypeManagerOpen(true)}
            className="btn-responsive bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Manage Types
          </Button>
          <Dialog 
            open={isDialogOpen} 
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingItem(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button 
                className="btn-responsive bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={() => {
                  setEditingItem(null);
                  resetForm();
                }}
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="mobile-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
                </DialogTitle>
                <DialogDescription>
                  Fill in the item details below.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-grid-responsive">
                  <div>
                    <Label htmlFor="name">Item Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Item name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select 
                      value={isAddingNewCategory ? '__add_new__' : formData.category} 
                      onValueChange={(value) => {
                        if (value === '__add_new__') {
                          setIsAddingNewCategory(true);
                          setFormData({...formData, category: ''});
                        } else {
                          setIsAddingNewCategory(false);
                          setFormData({...formData, category: value});
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                        <SelectItem value="__add_new__" className="text-blue-600 font-medium">
                          + Add New Category
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {isAddingNewCategory && (
                      <div className="mt-2">
                        <Input
                          placeholder="Enter new category name"
                          value={newCategory}
                          onChange={(e) => {
                            setNewCategory(e.target.value);
                            setFormData({...formData, category: e.target.value});
                          }}
                          className="border-blue-500 focus:border-blue-600"
                        />
                        <p className="text-xs text-blue-600 mt-1">Creating new category: {newCategory || '...'}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-grid-responsive">
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select 
                      value={isAddingNewType ? '__add_new__' : formData.type} 
                      onValueChange={(value) => {
                        if (value === '__add_new__') {
                          setIsAddingNewType(true);
                          setFormData({...formData, type: ''});
                        } else {
                          setIsAddingNewType(false);
                          setFormData({...formData, type: value});
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {types.map(type => (
                          <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                        ))}
                        <SelectItem value="__add_new__" className="text-blue-600 font-medium">
                          + Add New Type
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {isAddingNewType && (
                      <div className="mt-2">
                        <Input
                          placeholder="Enter new type name"
                          value={newType}
                          onChange={(e) => {
                            setNewType(e.target.value);
                            setFormData({...formData, type: e.target.value});
                          }}
                          className="border-blue-500 focus:border-blue-600"
                        />
                        <p className="text-xs text-blue-600 mt-1">Creating new type: {newType || '...'}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      placeholder="Storage location"
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-responsive">
                  <div>
                    <Label>Brought Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.broughtAt && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {formData.broughtAt ? format(formData.broughtAt, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={formData.broughtAt}
                          onSelect={(date) => date && setFormData({...formData, broughtAt: date})}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Used Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.usedAt && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {formData.usedAt ? format(formData.usedAt, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={formData.usedAt}
                          onSelect={(date) => setFormData({...formData, usedAt: date})}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="form-grid-responsive-3">
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <NumberInput
                      id="quantity"
                      value={formData.quantity ? Number(formData.quantity) : ''}
                      onChange={(value) => setFormData({...formData, quantity: value?.toString() || ''})}
                      min={0}
                      step={0.01}
                      decimals={2}
                      allowEmpty={false}
                      emptyValue={0}
                      placeholder="Enter quantity"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Select value={formData.unit} onValueChange={(value) => setFormData({...formData, unit: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(unit => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="reorderLevel">Reorder Level</Label>
                    <NumberInput
                      id="reorderLevel"
                      value={formData.reorderLevel ? Number(formData.reorderLevel) : ''}
                      onChange={(value) => setFormData({...formData, reorderLevel: value?.toString() || ''})}
                      min={0}
                      step={0.01}
                      decimals={2}
                      allowEmpty={false}
                      emptyValue={0}
                      placeholder="Enter reorder level"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="costPerUnit">Cost per Unit (₹)</Label>
                  <NumberInput
                    id="costPerUnit"
                    value={formData.costPerUnit ? Number(formData.costPerUnit) : ''}
                    onChange={(value) => setFormData({...formData, costPerUnit: value?.toString() || ''})}
                    min={0}
                    step={0.01}
                    decimals={2}
                    allowEmpty={false}
                    emptyValue={0}
                    placeholder="Enter unit cost"
                    required
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Supplier Information</h3>
                  <div className="form-grid-responsive">
                    <div>
                      <Label htmlFor="supplierName">Supplier Name</Label>
                      <Input
                        id="supplierName"
                        value={formData.supplierName}
                        onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
                        placeholder="Supplier name"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplierPhone">Supplier Phone</Label>
                      <Input
                        id="supplierPhone"
                        value={formData.supplierPhone}
                        onChange={(e) => setFormData({...formData, supplierPhone: e.target.value})}
                        placeholder="Phone number"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="supplierEmail">Supplier Email (Optional)</Label>
                    <Input
                      id="supplierEmail"
                      type="email"
                      value={formData.supplierEmail}
                      onChange={(e) => setFormData({...formData, supplierEmail: e.target.value})}
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Any additional notes"
                    rows={3}
                  />
                </div>

                {/* Barcode Section */}
                {barcodeValue && (
                  <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Barcode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <Label className="text-lg font-semibold">Generated Barcode</Label>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                        Auto-generated
                      </Badge>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-6 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-600">
                      <BarcodeDisplay value={barcodeValue} height={80} className="max-w-full" />
                    </div>

                    <div className="flex flex-wrap gap-3 justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={regenerateBarcode}
                        className="flex items-center gap-2 bg-white hover:bg-green-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Regenerate
                      </Button>
                    </div>

                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                      This unique barcode will be saved with the item
                    </p>
                  </div>
                )}

                <div className="responsive-actions">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="btn-responsive">
                    Cancel
                  </Button>
                  <Button type="submit" className="btn-responsive bg-gradient-to-r from-blue-600 to-purple-600">
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mobile: Collapsible filters toggle */}
      <div className="sm:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-center gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>{showFilters ? 'Hide Filters & Stats' : 'Show Filters & Stats'}</span>
          {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Stats, Date Filters, Mostly Used — always visible on desktop, collapsible on mobile */}
      <div className={`space-y-6 ${showFilters ? 'block' : 'hidden sm:block'}`}>
        {/* Stats Cards */}
        <InventoryStats
          totalItems={totalItems}
          totalValue={totalValue}
          lowStockCount={lowStockItems.length}
          categoriesCount={categories.length}
        />

        {/* Date Filters */}
        <InventoryDateFilters
          dateField={dateField}
          setDateField={setDateField}
          dateFilterMode={dateFilterMode}
          setDateFilterMode={setDateFilterMode}
          singleDate={singleDate}
          setSingleDate={setSingleDate}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          onDateChange={fetchItems}
          onClearFilters={clearDateFilters}
        />

        {/* Mostly Used Filters */}
        {(mostUsedCategories.length > 0 || mostUsedTypes.length > 0) && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-base">
                <Star className="h-4 w-4 text-yellow-600" />
                <span>Mostly Used</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mostUsedCategories.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Top Categories</Label>
                  <div className="flex flex-wrap gap-2">
                    {mostUsedCategories.map((category) => (
                      <Button
                        key={category.id}
                        variant={categoryFilter === category.name ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCategoryFilter(categoryFilter === category.name ? 'all' : category.name)}
                        className="text-xs"
                      >
                        {category.name} ({category.usageCount || 0})
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {mostUsedTypes.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Top Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {mostUsedTypes.map((type) => (
                      <Button
                        key={type.id}
                        variant={typeFilter === type.name ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTypeFilter(typeFilter === type.name ? 'all' : type.name)}
                        className="text-xs"
                      >
                        {type.name} ({type.usageCount || 0})
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Search, Filters, and View Toggle */}
      <InventorySearchFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        categories={categories}
        types={types}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="text-red-800 dark:text-red-300 font-medium">
                {lowStockItems.length} item(s) are running low on stock
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items Display */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
          <CardDescription>Manage your fabric and material inventory</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredItems.length > 0 ? (
            viewMode === 'table' ? (
              <InventoryTableView
                items={filteredItems}
                onStockAdjustment={handleStockAdjustment}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onGenerateBarcode={generateItemBarcode}
              />
            ) : (
              <InventoryGridView
                items={filteredItems}
                onStockAdjustment={handleStockAdjustment}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onGenerateBarcode={generateItemBarcode}
              />
            )
          ) : (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No inventory items</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || categoryFilter !== 'all' || typeFilter !== 'all' 
                  ? 'No items match your current filters.' 
                  : 'Add your first product to get started.'
                }
              </p>
              {!searchTerm && categoryFilter === 'all' && typeFilter === 'all' && (
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Item
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile/Tablet Card View for Table Mode */}
      {viewMode === 'table' && (
        <div className="lg:hidden space-y-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="border">
              <CardContent className="p-4">
                <div 
                  className="flex justify-between items-start cursor-pointer"
                  onClick={() => toggleItemExpansion(item.id)}
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{item.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{item.category} • {item.type}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="font-medium">{item.quantity} {item.unit}</span>
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
                    {item.barcodeURL && (
                      <img src={item.barcodeURL} alt="Barcode" className="w-20 h-10 mt-2" />
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">₹{(item.totalValue || 0).toLocaleString()}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">₹{(item.costPerUnit || 0).toFixed(2)}/unit</p>
                  </div>
                </div>
                
                {expandedItems.has(item.id) && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <p className="text-sm font-medium">Location: {item.location}</p>
                      {item.notes && <p className="text-sm text-gray-600 dark:text-gray-400">Notes: {item.notes}</p>}
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium">Supplier: {item.supplier?.name}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.supplier?.phone}</p>
                        {item.supplier?.phone && (
                          <ContactActions 
                            phone={item.supplier.phone}
                            message={`Hi, I need to reorder ${item.name}. Current stock: ${item.quantity} ${item.unit}`}
                          />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStockAdjustment(item.id, -1)}
                          disabled={item.quantity <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="font-medium">{item.quantity} {item.unit}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStockAdjustment(item.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateItemBarcode(item.id, item.name)}
                          disabled={!!item.barcodeURL}
                        >
                          <Barcode className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Type Manager Modal */}
      <Dialog open={isTypeManagerOpen} onOpenChange={setIsTypeManagerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Types</DialogTitle>
            <DialogDescription>Add, edit, or delete product types</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="New type name"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              />
              <Button onClick={handleAddType}>Add</Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {types.map((type) => (
                <div key={type.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <span>{type.name}</span>
                    {type.usageCount && (
                      <span className="text-xs text-gray-500 ml-2">({type.usageCount} uses)</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteType(type.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Manager Modal */}
      <Dialog open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>Add, edit, or delete product categories</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="New category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <Button onClick={handleAddCategory}>Add</Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <span>{category.name}</span>
                    {category.usageCount && (
                      <span className="text-xs text-gray-500 ml-2">({category.usageCount} uses)</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteCategory(category.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default Inventory;
