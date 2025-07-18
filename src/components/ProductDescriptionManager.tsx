import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, ChevronDown, ChevronRight, Package, AlertTriangle } from 'lucide-react';
import { Product, ProductDescription } from '@/utils/billingUtils';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import ProductNameInput from '@/components/ProductNameInput';
import SubItemDescriptionInput from '@/components/SubItemDescriptionInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface ProductDescriptionManagerProps {
  products: Product[];
  onProductsChange: (products: Product[]) => void;
  onSaveNewEntries?: (saveFunction: () => Promise<{newProductsArray: string[], newDescriptionsArray: string[]}>) => void;
}

const ProductDescriptionManager: React.FC<ProductDescriptionManagerProps> = ({
  products,
  onProductsChange,
  onSaveNewEntries
}) => {
  const [savedDescriptions, setSavedDescriptions] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{type: 'product' | 'description', value: string} | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Track new entries that haven't been saved yet
  const [newProductNames, setNewProductNames] = useState<Set<string>>(new Set());
  const [newDescriptions, setNewDescriptions] = useState<Set<string>>(new Set());

  // Fetch product names and descriptions dynamically from all bills in Firestore
  useEffect(() => {
    fetchDynamicOptionsFromBills();
  }, []);

  const fetchDynamicOptionsFromBills = async () => {
    try {
      // Fetch all bills to aggregate unique product names and descriptions
      const billsSnapshot = await getDocs(collection(db, 'bills'));
      const productNamesSet = new Set<string>();
      const descriptionsSet = new Set<string>();
      
      billsSnapshot.docs.forEach(doc => {
        const bill = doc.data();
        if (bill.products && Array.isArray(bill.products)) {
          bill.products.forEach((product: Product) => {
            // Collect unique product names
            if (product.name && product.name.trim()) {
              productNamesSet.add(product.name.trim());
            }
            
            // Collect unique descriptions from all sub-items
            if (product.descriptions && Array.isArray(product.descriptions)) {
              product.descriptions.forEach((desc: ProductDescription) => {
                if (desc.description && desc.description.trim()) {
                  descriptionsSet.add(desc.description.trim());
                }
              });
            }
          });
        }
      });
      
      // Also fetch from master collections for backward compatibility with new entries
      const descriptionsSnapshot = await getDocs(collection(db, 'descriptions'));
      descriptionsSnapshot.docs.forEach(doc => {
        const desc = doc.data().name || doc.data().description;
        if (desc && desc.trim()) {
          descriptionsSet.add(desc.trim());
        }
      });

      const productsSnapshot = await getDocs(collection(db, 'products'));
      productsSnapshot.docs.forEach(doc => {
        const name = doc.data().name;
        if (name && name.trim()) {
          productNamesSet.add(name.trim());
        }
      });
      
      // Convert sets to sorted arrays
      const uniqueProductNames = Array.from(productNamesSet).sort();
      const uniqueDescriptions = Array.from(descriptionsSet).sort();
      
      setProductNames(uniqueProductNames);
      setSavedDescriptions(uniqueDescriptions);
    } catch (error) {
      console.error('Error fetching dynamic options from bills:', error);
    }
  };

  // Function to call when bill is saved - exposed to parent
  const saveNewEntriesToFirestore = async () => {
    try {
      const newProductsArray = Array.from(newProductNames);
      const newDescriptionsArray = Array.from(newDescriptions);
      
      if (newProductsArray.length === 0 && newDescriptionsArray.length === 0) {
        return; // Nothing to save
      }

      // Save new product names
      for (const productName of newProductsArray) {
        if (productName.trim() && !productNames.includes(productName.trim())) {
          await addDoc(collection(db, 'products'), {
            name: productName.trim(),
            createdAt: new Date(),
            usageCount: 1
          });
        }
      }

      // Save new descriptions
      for (const description of newDescriptionsArray) {
        if (description.trim() && !savedDescriptions.includes(description.trim())) {
          await addDoc(collection(db, 'descriptions'), {
            name: description.trim(),
            description: description.trim(),
            createdAt: new Date(),
            usageCount: 1
          });
        }
      }

      // Refresh the saved data
      await fetchDynamicOptionsFromBills();
      
      // Clear the new entries sets
      setNewProductNames(new Set());
      setNewDescriptions(new Set());
      
      toast({
        title: "Success",
        description: `Saved ${newProductsArray.length} new products and ${newDescriptionsArray.length} new descriptions.`,
      });
      
      return { newProductsArray, newDescriptionsArray };
    } catch (error) {
      console.error('Error saving new entries:', error);
      toast({
        title: "Error",
        description: "Failed to save new entries to database.",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Expose the save function to parent component
  useEffect(() => {
    if (onSaveNewEntries) {
      onSaveNewEntries(saveNewEntriesToFirestore);
    }
  }, [onSaveNewEntries, newProductNames, newDescriptions]);

  // Delete functionality
  const handleDeleteItem = async () => {
    if (!deleteItem || deleteConfirmText !== 'DELETE') return;

    try {
      if (deleteItem.type === 'product') {
        // Find and delete from products collection
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const productDoc = productsSnapshot.docs.find(doc => doc.data().name === deleteItem.value);
        if (productDoc) {
          await deleteDoc(doc(db, 'products', productDoc.id));
        }
        
        // TODO: Add ROI cleanup for products
        // This would involve removing related ROI data from analytics
        
        // Remove from local state
        setProductNames(prev => prev.filter(name => name !== deleteItem.value));
        
        toast({
          title: "Success",
          description: `Product "${deleteItem.value}" deleted successfully.`,
        });
      } else {
        // Find and delete from descriptions collection
        const descriptionsSnapshot = await getDocs(collection(db, 'descriptions'));
        const descDoc = descriptionsSnapshot.docs.find(doc => 
          doc.data().name === deleteItem.value || doc.data().description === deleteItem.value
        );
        if (descDoc) {
          await deleteDoc(doc(db, 'descriptions', descDoc.id));
        }
        
        // Remove from local state
        setSavedDescriptions(prev => prev.filter(desc => desc !== deleteItem.value));
        
        toast({
          title: "Success",
          description: `Description "${deleteItem.value}" deleted successfully.`,
        });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete item.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteModal(false);
      setDeleteItem(null);
      setDeleteConfirmText('');
    }
  };

  const addProduct = () => {
    const newProduct: Product = {
      id: uuidv4(),
      name: '',
      total: 0,
      descriptions: [],
      expanded: true
    };
    onProductsChange([...products, newProduct]);
  };

  const removeProduct = (productId: string) => {
    onProductsChange(products.filter(p => p.id !== productId));
  };

  const updateProduct = (productId: string, field: keyof Product, value: any) => {
    const updatedProducts = products.map(product => {
      if (product.id === productId) {
        return { ...product, [field]: value };
      }
      return product;
    });
    onProductsChange(updatedProducts);
  };

  const toggleProductExpansion = (productId: string) => {
    const updatedProducts = products.map(product => {
      if (product.id === productId) {
        return { ...product, expanded: !product.expanded };
      }
      return product;
    });
    onProductsChange(updatedProducts);
  };

  const addDescription = (productId: string) => {
    const newDescription: ProductDescription = {
      id: uuidv4(),
      description: '',
      qty: 1, // Default to 1 (better usability)
      rate: 0,
      amount: 0
    };

    const updatedProducts = products.map(product => {
      if (product.id === productId) {
        return {
          ...product,
          descriptions: [...product.descriptions, newDescription],
          expanded: true // Auto-expand when adding new description
        };
      }
      return product;
    });
    onProductsChange(updatedProducts);
  };

  const removeDescription = (productId: string, descriptionId: string) => {
    const updatedProducts = products.map(product => {
      if (product.id === productId) {
        const updatedDescriptions = product.descriptions.filter(d => d.id !== descriptionId);
        const total = updatedDescriptions.reduce((sum, desc) => sum + desc.amount, 0);
        return {
          ...product,
          descriptions: updatedDescriptions,
          total
        };
      }
      return product;
    });
    onProductsChange(updatedProducts);
  };

  const updateDescription = (productId: string, descriptionId: string, field: keyof ProductDescription, value: any) => {
    const updatedProducts = products.map(product => {
      if (product.id === productId) {
        const updatedDescriptions = product.descriptions.map(desc => {
          if (desc.id === descriptionId) {
            const updatedDesc = { ...desc, [field]: value };
            
            // Special handling for quantity field
            if (field === 'qty') {
              // Ensure quantity is valid and defaults to 1 if invalid
              const qtyValue = typeof value === 'number' && value >= 0.1 ? value : 1;
              updatedDesc.qty = qtyValue;
            }
            
            // Auto-calculate amount only when both qty and rate have valid positive values
            if (field === 'qty' || field === 'rate') {
              const finalQty = field === 'qty' ? updatedDesc.qty : desc.qty;
              const finalRate = field === 'rate' ? (value || 0) : desc.rate;
              
              // Only calculate amount if both values are valid and positive
              if (finalQty > 0 && finalRate > 0) {
                updatedDesc.amount = finalQty * finalRate;
              } else {
                // Set amount to 0 if either value is invalid/empty/zero
                updatedDesc.amount = 0;
              }
            }
            
            return updatedDesc;
          }
          return desc;
        });
        
        // Recalculate product total
        const total = updatedDescriptions.reduce((sum, desc) => sum + desc.amount, 0);
        
        return {
          ...product,
          descriptions: updatedDescriptions,
          total
        };
      }
      return product;
    });
    onProductsChange(updatedProducts);
  };

  const handleDescriptionSelect = (productId: string, descriptionId: string, selectedDescription: string) => {
    // Only process if the selected description is different from current value
    const product = products.find(p => p.id === productId);
    const currentDesc = product?.descriptions.find(d => d.id === descriptionId);
    
    if (currentDesc && currentDesc.description === selectedDescription) {
      return; // No change needed
    }
    
    // Track if this is a new description and add it to the options list
    if (!savedDescriptions.includes(selectedDescription) && selectedDescription.trim()) {
      setNewDescriptions(prev => new Set([...prev, selectedDescription]));
      setSavedDescriptions(prev => [...prev, selectedDescription]);
    }
    updateDescription(productId, descriptionId, 'description', selectedDescription);
  };

  const handleProductNameSelect = (productId: string, selectedName: string) => {
    // Only process if the selected name is different from current value
    const product = products.find(p => p.id === productId);
    
    if (product && product.name === selectedName) {
      return; // No change needed
    }
    
    // Track if this is a new product name and add it to the options list
    if (!productNames.includes(selectedName) && selectedName.trim()) {
      setNewProductNames(prev => new Set([...prev, selectedName]));
      setProductNames(prev => [...prev, selectedName]);
    }
    updateProduct(productId, 'name', selectedName);
  };

  // Calculate grand total of all products and notify parent when it changes
  useEffect(() => {
    const grandTotal = products.reduce((sum, product) => sum + product.total, 0);
    // Force a re-render of parent component calculations by calling onProductsChange
    // This ensures the bill summary updates when product totals change
    if (products.length > 0) {
      onProductsChange([...products]);
    }
  }, [products.map(p => p.total).join(','), products.length]);

  return (
    <div className="space-y-4">
      {/* Sticky Action Bar */}
      <div className="sticky top-4 bg-white border-2 border-purple-200 rounded-lg p-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Products & Services</h2>
            <span className="text-sm text-gray-500">({products.length} products)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={addProduct}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Navigate back to billing page
                const currentPath = window.location.pathname;
                if (currentPath.includes('/billing/')) {
                  // If we're in a billing route, go back to billing dashboard
                  window.location.href = '/billing';
                } else {
                  // Otherwise, use browser back
                  window.history.back();
                }
              }}
              size="sm"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Back to Billing
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {products.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No products added yet. Click "Add Product" in the action bar above to get started.</p>
            </div>
          ) : (
            products.map(product => (
              <div key={product.id} className="border-2 border-purple-200 rounded-lg bg-white shadow-sm">
                {/* Header Panel - Main Product */}
                <div className="p-4 bg-purple-50 border-b border-purple-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
                      {/* Chevron Toggle */}
                      <div className="sm:col-span-1 lg:col-span-1 flex justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleProductExpansion(product.id)}
                          className="p-2 hover:bg-purple-100"
                        >
                          {product.expanded ? (
                            <ChevronDown className="h-4 w-4 text-purple-600" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-purple-600" />
                          )}
                        </Button>
                      </div>                      {/* Product Name */}
                      <div className="sm:col-span-2 lg:col-span-6">
                        <Label className="text-sm font-medium text-gray-700">Product Name *</Label>
                        <ProductNameInput
                          value={product.name}
                          onChange={(value) => handleProductNameSelect(product.id, value)}
                          options={productNames}
                          placeholder="Type or select product name..."
                          className="mt-1 bg-white w-full"
                          required
                        />
                      </div>

                  {/* Total Amount */}
                  <div className="sm:col-span-1 lg:col-span-3">
                    <Label className="text-sm font-medium text-gray-700">Total (₹)</Label>
                    <div className="mt-1 p-2 bg-white border border-gray-200 rounded-md">
                      <span className="font-semibold text-purple-600">
                        ₹{product.total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Add Sub-Item & Delete buttons */}
                  <div className="sm:col-span-2 lg:col-span-2 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addDescription(product.id)}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeProduct(product.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Expanded Panel - Sub-Items (Descriptions) */}
              {product.expanded && (
                <div className="p-4 space-y-3">
                  {product.descriptions.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                      <p className="text-sm">No items added yet. Click the "+" button above to add an item.</p>
                    </div>
                  ) : (
                    product.descriptions.map(desc => (
                      <div key={desc.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                          {/* Sub-Item Icon */}
                          <div className="sm:col-span-1 lg:col-span-1 flex items-center justify-center">
                            <div className="h-4 w-4 text-gray-400">
                              <svg viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                              </svg>
                            </div>
                          </div>

                          {/* Description */}
                          <div className="sm:col-span-2 lg:col-span-4">
                            <Label className="text-sm font-medium text-gray-700">Sub-Item Description *</Label>
                            <SubItemDescriptionInput
                              value={desc.description}
                              onChange={(value) => handleDescriptionSelect(product.id, desc.id, value)}
                              options={savedDescriptions}
                              placeholder="Type or select description..."
                              className="mt-1 bg-white w-full"
                              required
                            />
                          </div>

                          {/* Quantity */}
                          <div className="sm:col-span-1 lg:col-span-2">
                            <Label className="text-sm font-medium text-gray-700">Qty *</Label>
                            <NumberInput
                              value={desc.qty}
                              onChange={(value) => {
                                // Handle quantity field: always default to 1 when empty, allow any valid number >= 0.1
                                if (value === null || value === undefined) {
                                  updateDescription(product.id, desc.id, 'qty', 1);
                                } else {
                                  updateDescription(product.id, desc.id, 'qty', value);
                                }
                              }}
                              min={0.1}
                              step={0.1}
                              decimals={1}
                              allowEmpty={false}
                              emptyValue={1}
                              className="mt-1 bg-white"
                              placeholder="1"
                              required
                            />
                          </div>

                          {/* Rate */}
                          <div className="sm:col-span-1 lg:col-span-2">
                            <Label className="text-sm font-medium text-gray-700">Rate (₹) *</Label>
                            <NumberInput
                              value={desc.rate === 0 ? '' : desc.rate}
                              onChange={(value) => updateDescription(product.id, desc.id, 'rate', value || 0)}
                              min={0}
                              step={0.01}
                              decimals={2}
                              allowEmpty={false}
                              emptyValue={0}
                              className="mt-1 bg-white"
                              placeholder="Rate"
                              required
                            />
                          </div>

                          {/* Amount */}
                          <div className="sm:col-span-1 lg:col-span-2">
                            <Label className="text-sm font-medium text-gray-700">Amount (₹)</Label>
                            <div className="mt-1 p-2 bg-white border border-gray-200 rounded-md">
                              <span className="font-semibold text-green-700">
                                ₹{desc.amount.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Delete button */}
                          <div className="sm:col-span-1 lg:col-span-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeDescription(product.id, desc.id)}
                              className="w-full text-red-600 border-red-200 hover:bg-red-50 mt-6"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Add Item button at bottom of expanded panel */}
                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={() => addDescription(product.id)}
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add Item
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the {deleteItem?.type} "{deleteItem?.value}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800">Warning</h4>
                  <p className="text-sm text-red-700 mt-1">
                    This action cannot be undone. The {deleteItem?.type} will be permanently removed from the database.
                    {deleteItem?.type === 'product' && ' All associated ROI data will also be cleaned up.'}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Type <strong>DELETE</strong> to confirm this action:
            </p>
            <Input
              placeholder="Type DELETE to confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteItem(null);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteItem}
              disabled={deleteConfirmText !== 'DELETE'}
            >
              Delete {deleteItem?.type}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Add Product Button - Shows when scrolled down */}
      {products.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            type="button"
            onClick={addProduct}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-full w-14 h-14 p-0"
            title="Add Another Product"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProductDescriptionManager;
