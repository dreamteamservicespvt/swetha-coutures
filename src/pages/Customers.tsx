
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteDoc, doc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, MessageSquare, Grid, List } from 'lucide-react';
import CustomerFilters from '@/components/CustomerFilters';
import CustomerProfilePanel from '@/components/CustomerProfilePanel';
import BulkWhatsAppModal from '@/components/BulkWhatsAppModal';
import CustomerWhatsAppModal from '@/components/CustomerWhatsAppModal';
import CustomersStats from '@/components/CustomersStats';
import CustomerForm from '@/components/CustomerForm';
import CustomersTable from '@/components/CustomersTable';
import CustomersGridView from '@/components/CustomersGridView';

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
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppCustomer, setWhatsAppCustomer] = useState<Customer | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // Default to grid view
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string | null>(null);

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
    let filtered = customers;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(customer =>
        (customer.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone || '').includes(searchTerm) ||
        (customer.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.city || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply payment status filter (based on outstanding balance)
    if (paymentStatusFilter) {
      filtered = filtered.filter(customer => {
        const totalSpent = customer.totalSpent || 0;
        // This is a simplified logic - in a real app, you'd fetch actual bill data
        switch (paymentStatusFilter) {
          case 'outstanding':
            return totalSpent > 0 && (customer.totalOrders || 0) > 0;
          case 'paid':
            return totalSpent > 0;
          case 'partial':
            return totalSpent > 0 && (customer.totalOrders || 0) > 0;
          default:
            return true;
        }
      });
    }
    
    setFilteredCustomers(filtered);
  }, [customers, searchTerm, paymentStatusFilter]);

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

  const handlePaymentStatusFilter = (status: string | null) => {
    setPaymentStatusFilter(status);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
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

  const handleWhatsAppCustomer = (customer: Customer) => {
    setWhatsAppCustomer(customer);
    setIsWhatsAppModalOpen(true);
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
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-2 sm:px-3"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline ml-1 sm:ml-2">List</span>
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 px-2 sm:px-3"
            >
              <Grid className="h-4 w-4" />
              <span className="hidden sm:inline ml-1 sm:ml-2">Grid</span>
            </Button>
          </div>
          
          {selectedCustomers.size > 0 && (
            <Button
              onClick={handleBulkWhatsApp}
              variant="outline"
              className="btn-responsive bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
            >
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline ml-1 sm:ml-2">Bulk WhatsApp ({selectedCustomers.size})</span>
              <span className="sm:hidden">({selectedCustomers.size})</span>
            </Button>
          )}
          <Button 
            className="btn-responsive bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={handleAddCustomer}
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline ml-1 sm:ml-2">Add Customer</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <CustomersStats customers={customers} />

      {/* Filters */}
      <CustomerFilters
        onDateFilter={handleDateFilter}
        onTypeFilter={handleTypeFilter}
        onPaymentStatusFilter={handlePaymentStatusFilter}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        loading={loading}
      />

      {/* Customers Display - Dynamic based on view mode */}
      {viewMode === 'grid' ? (
        <CustomersGridView
          customers={filteredCustomers}
          selectedCustomers={selectedCustomers}
          searchTerm={searchTerm}
          onSelectCustomer={handleSelectCustomer}
          onCustomerClick={handleCustomerClick}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onWhatsApp={handleWhatsAppCustomer}
          onAddCustomer={handleAddCustomer}
        />
      ) : (
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
          onWhatsApp={handleWhatsAppCustomer}
          onAddCustomer={handleAddCustomer}
        />
      )}

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

      {/* Individual Customer WhatsApp Modal */}
      {whatsAppCustomer && (
        <CustomerWhatsAppModal
          customer={whatsAppCustomer}
          isOpen={isWhatsAppModalOpen}
          onClose={() => {
            setIsWhatsAppModalOpen(false);
            setWhatsAppCustomer(null);
          }}
        />
      )}
      </div>
    </div>
  );
};

export default Customers;
