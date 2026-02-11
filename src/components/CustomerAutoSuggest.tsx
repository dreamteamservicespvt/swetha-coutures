
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Plus, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  measurements?: any;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: any;
}

interface CustomerAutoSuggestProps {
  value: string;
  onChange: (value: string) => void;
  onCustomerSelect: (customer: Customer) => void;
  placeholder?: string;
}

const CustomerAutoSuggest: React.FC<CustomerAutoSuggestProps> = ({
  value,
  onChange,
  onCustomerSelect,
  placeholder = "Customer name"
}) => {
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const customersSnapshot = await getDocs(collection(db, 'customers'));
      const customers = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setAllCustomers(customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleInputChange = (inputValue: string) => {
    onChange(inputValue);
    
    if (inputValue.length > 1) {
      const filtered = allCustomers.filter(customer =>
        customer.name?.toLowerCase().includes(inputValue.toLowerCase()) ||
        customer.phone?.includes(inputValue) ||
        customer.email?.toLowerCase().includes(inputValue.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (customer: Customer) => {
    onChange(customer.name);
    onCustomerSelect(customer);
    setShowSuggestions(false);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) {
      toast({
        title: "Error",
        description: "Name and phone are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const customerData = {
        ...newCustomer,
        totalOrders: 0,
        totalSpent: 0,
        measurements: {},
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'customers'), customerData);
      const customer = { id: docRef.id, ...customerData };
      
      // Add to local state
      setAllCustomers(prev => [...prev, customer]);
      
      // Select the new customer
      onChange(customer.name);
      onCustomerSelect(customer);
      
      // Reset form and close modal
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      setIsCreateModalOpen(false);
      setShowSuggestions(false);
      
      toast({
        title: "Success",
        description: "New customer created successfully",
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "Failed to create customer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <Label htmlFor="customerName" className="flex items-center">
        <User className="h-4 w-4 mr-2" />
        Customer Name
      </Label>
      <div className="flex space-x-2">
        <Input
          id="customerName"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          required
          className="flex-1"
        />
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <Label htmlFor="newName">Name *</Label>
                <Input
                  id="newName"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  placeholder="Customer name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="newPhone">Phone *</Label>
                <Input
                  id="newPhone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                  placeholder="Phone number"
                  required
                />
              </div>
              <div>
                <Label htmlFor="newEmail">Email</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                  placeholder="Email address"
                />
              </div>
              <div>
                <Label htmlFor="newAddress">Address</Label>
                <Input
                  id="newAddress"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  placeholder="Customer address"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Customer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((customer) => (
            <div
              key={customer.id}
              className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
              onClick={() => handleSuggestionClick(customer)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{customer.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{customer.phone}</div>
                  {customer.email && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{customer.email}</div>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400">
                  {customer.totalOrders ? `${customer.totalOrders} orders` : 'New customer'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showSuggestions && suggestions.length === 0 && value.length > 1 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4">
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-3">No existing customers found</div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setNewCustomer({...newCustomer, name: value});
                setIsCreateModalOpen(true);
                setShowSuggestions(false);
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create "{value}" as new customer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerAutoSuggest;
