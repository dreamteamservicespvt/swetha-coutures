
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteDoc, doc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, MessageSquare } from 'lucide-react';
import CustomerFilters from '@/components/CustomerFilters';
import CustomerProfilePanel from '@/components/CustomerProfilePanel';
import BulkWhatsAppModal from '@/components/BulkWhatsAppModal';
import CustomersStats from '@/components/CustomersStats';
import CustomerForm from '@/components/CustomerForm';
import CustomersTable from '@/components/CustomersTable';

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
  createdAt: any;
}

const Customers = () => {
  const { userData } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [isBulkWhatsAppOpen, setIsBulkWhatsAppOpen] = useState(false);

  useEffect(() => {
    // Set up real-time listener for customers
    const customersQuery = query(
      collection(db, 'customers'),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(customersQuery, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      
      setCustomers(customersData);
      setFilteredCustomers(customersData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Apply search filter
    const filtered = customers.filter(customer =>
      (customer.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.phone || '').includes(searchTerm) ||
      (customer.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.city || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCustomers(filtered);
  }, [customers, searchTerm]);

  const handleDateFilter = (startDate: Date | null, endDate: Date | null) => {
    if (!startDate || !endDate) {
      setFilteredCustomers(customers);
      return;
    }

    const filtered = customers.filter(customer => {
      if (!customer.createdAt) return false;
      const customerDate = customer.createdAt.toDate ? customer.createdAt.toDate() : new Date(customer.createdAt);
      return customerDate >= startDate && customerDate <= endDate;
    });
    setFilteredCustomers(filtered);
  };

  const handleTypeFilter = (type: string | null) => {
    if (!type) {
      setFilteredCustomers(customers);
      return;
    }

    const filtered = customers.filter(customer => customer.customerType === type);
    setFilteredCustomers(filtered);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleDelete = async (customerId: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await deleteDoc(doc(db, 'customers', customerId));
        toast({
          title: "Success",
          description: "Customer deleted successfully",
        });
      } catch (error) {
        console.error('Error deleting customer:', error);
        toast({
          title: "Error",
          description: "Failed to delete customer",
          variant: "destructive",
        });
      }
    }
  };

  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsProfilePanelOpen(true);
  };

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    const newSelected = new Set(selectedCustomers);
    if (checked) {
      newSelected.add(customerId);
    } else {
      newSelected.delete(customerId);
    }
    setSelectedCustomers(newSelected);
    setIsSelectAll(newSelected.size === filteredCustomers.length);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredCustomers.map(c => c.id));
      setSelectedCustomers(allIds);
    } else {
      setSelectedCustomers(new Set());
    }
    setIsSelectAll(checked);
  };

  const handleBulkWhatsApp = () => {
    const selectedPhones = filteredCustomers
      .filter(customer => selectedCustomers.has(customer.id))
      .map(customer => customer.phone)
      .filter(phone => phone);
    
    if (selectedPhones.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select customers with phone numbers",
        variant: "destructive",
      });
      return;
    }
    
    setIsBulkWhatsAppOpen(true);
  };

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setIsDialogOpen(true);
  };

  const handleCloseForm = () => {
    setIsDialogOpen(false);
    setEditingCustomer(null);
  };

  if (loading) {
    return (
      <div className="mobile-page-layout">
        <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
          <div className="mobile-page-header">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-dark-fix">Customer Management</h1>
          </div>
          <div className="stats-grid-responsive">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-24 sm:h-32 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const selectedPhoneNumbers = filteredCustomers
    .filter(customer => selectedCustomers.has(customer.id))
    .map(customer => customer.phone)
    .filter(phone => phone);

  return (
    <div className="mobile-page-layout">
      <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="mobile-page-header">
          <div className="space-y-1 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-dark-fix">Customer Management</h1>
            <p className="responsive-text-base text-muted-dark-fix">Manage customer information and relationships</p>
          </div>
        <div className="responsive-actions">
          {selectedCustomers.size > 0 && (
            <Button
              onClick={handleBulkWhatsApp}
              variant="outline"
              className="btn-responsive bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
            >
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
              Bulk WhatsApp ({selectedCustomers.size})
            </Button>
          )}
          <Button 
            className="btn-responsive bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={handleAddCustomer}
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <CustomersStats customers={customers} />

      {/* Filters */}
      <CustomerFilters
        onDateFilter={handleDateFilter}
        onTypeFilter={handleTypeFilter}
        loading={loading}
      />

      {/* Search */}
      <div className="search-filter-container">
        <div className="relative flex-1">
          <Search className="absolute left-2 sm:left-3 top-2.5 sm:top-3 h-3 w-3 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 sm:pl-10 responsive-text-sm h-8 sm:h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Customers Table */}
      <CustomersTable
        customers={filteredCustomers}
        selectedCustomers={selectedCustomers}
        isSelectAll={isSelectAll}
        searchTerm={searchTerm}
        onSelectCustomer={handleSelectCustomer}
        onSelectAll={handleSelectAll}
        onCustomerClick={handleCustomerClick}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAddCustomer={handleAddCustomer}
      />

      {/* Customer Form */}
      <CustomerForm
        isOpen={isDialogOpen}
        onClose={handleCloseForm}
        editingCustomer={editingCustomer}
      />

      {/* Customer Profile Panel */}
      <CustomerProfilePanel
        customer={selectedCustomer}
        isOpen={isProfilePanelOpen}
        onClose={() => setIsProfilePanelOpen(false)}
      />

      {/* Bulk WhatsApp Modal */}
      <BulkWhatsAppModal
        isOpen={isBulkWhatsAppOpen}
        onClose={() => setIsBulkWhatsAppOpen(false)}
        phoneNumbers={selectedPhoneNumbers}
      />
      </div>
    </div>
  );
};

export default Customers;
