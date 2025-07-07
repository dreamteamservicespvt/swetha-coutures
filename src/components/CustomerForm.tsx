
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  pincode?: string;
  notes?: string;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  customerType: 'regular' | 'premium' | 'vip';
  sizes?: Record<string, string>; // Add sizes field
}

interface CustomerFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingCustomer: Customer | null;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ isOpen, onClose, editingCustomer }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    customerType: 'regular' as 'regular' | 'premium' | 'vip',
    sizes: {} as Record<string, string>
  });

  const [customSizeLabel, setCustomSizeLabel] = useState('');
  const [customSizeValue, setCustomSizeValue] = useState('');

  React.useEffect(() => {
    if (editingCustomer) {
      setFormData({
        name: editingCustomer.name || '',
        phone: editingCustomer.phone || '',
        email: editingCustomer.email || '',
        address: editingCustomer.address || '',
        notes: editingCustomer.notes || '',
        customerType: editingCustomer.customerType || 'regular',
        sizes: editingCustomer.sizes || {}
      });
    } else {
      resetForm();
    }
  }, [editingCustomer]);

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      customerType: 'regular',
      sizes: {}
    });
  };

  const handleSizeChange = (sizeKey: string, value: string) => {
    setFormData({
      ...formData,
      sizes: { ...formData.sizes, [sizeKey]: value }
    });
  };

  const handleAddCustomSize = () => {
    if (customSizeLabel.trim() && customSizeValue.trim()) {
      setFormData({
        ...formData,
        sizes: { ...formData.sizes, [customSizeLabel.trim()]: customSizeValue.trim() }
      });
      setCustomSizeLabel('');
      setCustomSizeValue('');
    }
  };

  const handleRemoveSize = (sizeKey: string) => {
    const updatedSizes = { ...formData.sizes };
    delete updatedSizes[sizeKey];
    setFormData({
      ...formData,
      sizes: updatedSizes
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customerData = {
        ...formData,
        totalOrders: editingCustomer?.totalOrders || 0,
        totalSpent: editingCustomer?.totalSpent || 0,
        lastOrderDate: editingCustomer?.lastOrderDate || null,
        ...(editingCustomer ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() })
      };

      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), customerData);
        toast({
          title: "Success",
          description: "Customer updated successfully",
        });
      } else {
        await addDoc(collection(db, 'customers'), customerData);
        toast({
          title: "Success",
          description: "Customer added successfully",
        });
      }

      onClose();
      resetForm();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({
        title: "Error",
        description: "Failed to save customer",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="mobile-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
          </DialogTitle>
          <DialogDescription>
            Fill in the customer details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name and Phone - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Customer name"
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="Phone number"
                required
              />
            </div>
          </div>
          
          {/* Email and Customer Type - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="Email address"
              />
            </div>
            <div>
              <Label htmlFor="customerType">Customer Type</Label>
              <select
                id="customerType"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.customerType}
                onChange={(e) => setFormData({...formData, customerType: e.target.value as 'regular' | 'premium' | 'vip'})}
              >
                <option value="regular">Regular</option>
                <option value="premium">Premium</option>
                <option value="vip">VIP</option>
              </select>
            </div>
          </div>

          {/* Address - Full Width */}
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              placeholder="Full address"
              rows={2}
            />
          </div>

          {/* Size Measurements Section */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Size Measurements</Label>
            
            {/* Existing Size Inputs */}
            {Object.keys(formData.sizes).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(formData.sizes).map(([sizeKey, sizeValue]) => (
                  <div key={sizeKey} className="flex items-center space-x-2">
                    <div className="flex-1">
                      <Label htmlFor={`size-${sizeKey}`} className="text-sm">
                        {sizeKey}
                      </Label>
                      <Input
                        id={`size-${sizeKey}`}
                        value={sizeValue}
                        onChange={(e) => handleSizeChange(sizeKey, e.target.value)}
                        placeholder="inches"
                        className="text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSize(sizeKey)}
                      className="text-red-600 hover:bg-red-50 mt-5"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Custom Size */}
            <div className="border-t pt-4">
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <Label htmlFor="customSizeLabel" className="text-sm">
                    Size Label
                  </Label>
                  <Input
                    id="customSizeLabel"
                    value={customSizeLabel}
                    onChange={(e) => setCustomSizeLabel(e.target.value)}
                    placeholder="e.g., Bust, Waist, Length"
                    className="text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="customSizeValue" className="text-sm">
                    Measurement
                  </Label>
                  <Input
                    id="customSizeValue"
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

          {/* Notes - Full Width */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Additional notes about the customer"
              rows={3}
            />
          </div>

          {/* Action Buttons - Responsive */}
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600">
              {editingCustomer ? 'Update Customer' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerForm;
