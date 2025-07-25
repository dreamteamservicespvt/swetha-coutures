
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
import { enrichCustomersWithStats } from '@/utils/customerCalculations';

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
  totalBills?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  customerType: 'regular' | 'premium' | 'vip';
  createdAt: any;
  sizes?: Record<string, string>; // Add sizes field
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
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
  const [profilePanelInitialTab, setProfilePanelInitialTab] = useState<'orders' | 'bills'>('orders');
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [isBulkWhatsAppOpen, setIsBulkWhatsAppOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppCustomer, setWhatsAppCustomer] = useState<Customer | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // Default to grid view
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'totalSpent' | 'totalOrders' | 'recent'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [enrichingCustomers, setEnrichingCustomers] = useState(false);

  useEffect(() => {
    // Set up real-time listener for customers
    const customersQuery = query(
      collection(db, 'customers'),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(customersQuery, async (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      
      // Enrich customers with real-time stats
      setEnrichingCustomers(true);
      try {
        const enrichedCustomers = await enrichCustomersWithStats(customersData);
        setCustomers(enrichedCustomers);
        setFilteredCustomers(enrichedCustomers);
      } catch (error) {
        console.error('Error enriching customers:', error);
        // Fall back to basic customer data
        setCustomers(customersData);
        setFilteredCustomers(customersData);
      } finally {
        setEnrichingCustomers(false);
        setLoading(false);
      }
    }, (error) => {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
      setLoading(false);
      setEnrichingCustomers(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
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
    
    // Apply payment status filter based on actual bill payment status
    if (paymentStatusFilter) {
      filtered = filtered.filter(customer => {
        switch (paymentStatusFilter) {
          case 'paid':
            return customer.paymentStatus === 'paid';
          case 'partial':
            return customer.paymentStatus === 'partial';
          case 'unpaid':
            return customer.paymentStatus === 'unpaid';
          case 'outstanding':
            return customer.paymentStatus === 'partial' || customer.paymentStatus === 'unpaid';
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered = filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
          break;
        case 'totalSpent':
          aValue = a.totalSpent || 0;
          bValue = b.totalSpent || 0;
          break;
        case 'totalOrders':
          aValue = a.totalOrders || 0;
          bValue = b.totalOrders || 0;
          break;
        case 'recent':
          aValue = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          bValue = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          break;
        default:
          aValue = a.name || '';
          bValue = b.name || '';
      }

      if (sortOrder === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });
    
    setFilteredCustomers(filtered);
  }, [customers, searchTerm, paymentStatusFilter, sortBy, sortOrder]);

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

  const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setSortBy(sortBy as any);
    setSortOrder(sortOrder);
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

  const handleCustomerClick = (customer: Customer, initialTab: 'orders' | 'bills' = 'orders') => {
    setSelectedCustomer(customer);
    setProfilePanelInitialTab(initialTab);
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

  if (enrichingCustomers && customers.length === 0) {
    return (
      <div className="mobile-page-layout">
        <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
          <div className="mobile-page-header">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-dark-fix">Customer Management</h1>
            <p className="text-gray-600 text-sm sm:text-base">Calculating customer statistics...</p>
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
            <p className="responsive-text-base text-muted-dark-fix">
              Manage customer information and relationships
              {enrichingCustomers && (
                <span className="ml-2 inline-flex items-center gap-1 text-blue-600">
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  Updating statistics...
                </span>
              )}
            </p>
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
        onSortChange={handleSortChange}
        searchTerm={searchTerm}
        loading={loading || enrichingCustomers}
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
        initialTab={profilePanelInitialTab}
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
