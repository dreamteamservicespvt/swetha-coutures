
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

import { PendingBill } from '@/utils/customerCalculations';
import { AlertTriangle, IndianRupee, Merge } from 'lucide-react';
import CustomerDuplicatesDialog from '@/components/CustomerDuplicatesDialog';
import FilterPanel from '@/components/FilterPanel';

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
  outstandingBalance?: number;
  pendingBills?: PendingBill[];
  oldestPendingDate?: Date;
  daysPending?: number;
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
  const [profilePanelInitialTab, setProfilePanelInitialTab] = useState<'orders' | 'bills'>('bills');
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
  /**
   * Collections view is ON by default (Req 3): only customers who owe money, oldest debt
   * first, so the admin opens the page already looking at who to chase. Turning it off
   * hands control back to the normal filters below.
   */
  const [collectionsFirst, setCollectionsFirst] = useState(true);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);

  useEffect(() => {
    // Set up real-time listener for customers
    const customersQuery = query(
      collection(db, 'customers'),
      orderBy('createdAt', 'desc')
    );
    
    // Guards against re-running the (relatively expensive) enrichment when Firestore
    // re-emits the same customer set — it fires once from cache and again from the server.
    let lastSignature = '';
    let run = 0;

    const unsubscribe = onSnapshot(customersQuery, async (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];

      // Paint the page from the customer records straight away; the balances arrive a beat
      // later. Waiting for enrichment before the first render left the screen blank for
      // seconds on every visit.
      setLoading(false);
      setCustomers(prev => (prev.length === 0 ? customersData : prev));

      const signature = customersData.map(c => c.id).join(',');
      if (signature === lastSignature) return;
      lastSignature = signature;

      const thisRun = ++run;
      setEnrichingCustomers(true);
      try {
        const enrichedCustomers = await enrichCustomersWithStats(customersData);
        if (thisRun !== run) return; // a newer snapshot already superseded this one
        setCustomers(enrichedCustomers);
      } catch (error) {
        console.error('Error enriching customers:', error);
        setCustomers(customersData);
      } finally {
        if (thisRun === run) setEnrichingCustomers(false);
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

    // Collections view wins over the manual filters: only people who owe money, and the
    // oldest debt at the top (Req 3).
    if (collectionsFirst) {
      const pending = filtered
        .filter(customer => (customer.outstandingBalance || 0) > 0.5)
        .sort((a, b) => {
          const aTime = a.oldestPendingDate ? new Date(a.oldestPendingDate).getTime() : Infinity;
          const bTime = b.oldestPendingDate ? new Date(b.oldestPendingDate).getTime() : Infinity;
          if (aTime !== bTime) return aTime - bTime;
          return (b.outstandingBalance || 0) - (a.outstandingBalance || 0);
        });
      setFilteredCustomers(pending);
      return;
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
  }, [customers, searchTerm, paymentStatusFilter, sortBy, sortOrder, collectionsFirst]);

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

  const handleCustomerClick = (customer: Customer, initialTab: 'orders' | 'bills' = 'bills') => {
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

  const pendingCustomers = customers.filter(c => (c.outstandingBalance || 0) > 0.5);

  // Duplicate customer records that share a phone number match the same bills, so summing
  // every record would overstate the amount owed. De-duplicate on phone for the headline
  // figure — it must agree with the dashboard's collections panel.
  const totalOutstanding = Array.from(
    pendingCustomers
      .reduce((map, c) => {
        const key = (c.phone || '').replace(/\D/g, '') || c.id;
        map.set(key, Math.max(map.get(key) || 0, c.outstandingBalance || 0));
        return map;
      }, new Map<string, number>())
      .values()
  ).reduce((sum, amount) => sum + amount, 0);

  // Count of phone numbers claimed by more than one customer record.
  const duplicateCount = (() => {
    const counts = new Map<string, number>();
    customers.forEach((c) => {
      const key = (c.phone || '').replace(/\D/g, '').slice(-10);
      if (key.length < 10) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.values()).filter((n) => n > 1).length;
  })();

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
                  {/* A <span>, not a <div>: this sits inside a <p>, and block-level content
                      there is invalid HTML that React warns about. */}
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Updating balances…
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

      {/* Duplicate records inflate the amount owed, because bill lookup falls back to
          matching on phone — offer the fix rather than just tolerating it. */}
      {duplicateCount > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-orange-300 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Merge className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {duplicateCount} phone number{duplicateCount === 1 ? '' : 's'} used by more than one customer
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
                The same bills get counted against each copy, so the amount owed looks higher than it is.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDuplicatesOpen(true)}
            className="shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100 dark:text-orange-300"
          >
            Review &amp; merge
          </Button>
        </div>
      )}

      {/* Collections queue banner — who to collect from first (Req 3) */}
      <div
        className={`rounded-xl border p-3 sm:p-4 ${
          collectionsFirst
            ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle
              className={`mt-0.5 h-5 w-5 shrink-0 ${collectionsFirst ? 'text-amber-600' : 'text-gray-400'}`}
            />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {collectionsFirst ? 'Payments to collect' : 'All customers'}
              </p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {collectionsFirst ? (
                  <>
                    {pendingCustomers.length} customer{pendingCustomers.length === 1 ? '' : 's'} owe{' '}
                    <span className="font-semibold text-red-600">
                      ₹{totalOutstanding.toLocaleString()}
                    </span>{' '}
                    — oldest pending first
                  </>
                ) : (
                  <>
                    {pendingCustomers.length} customer{pendingCustomers.length === 1 ? '' : 's'} still
                    owe ₹{totalOutstanding.toLocaleString()}
                  </>
                )}
              </p>
            </div>
          </div>
          <Button
            variant={collectionsFirst ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCollectionsFirst(!collectionsFirst)}
            className={collectionsFirst ? 'bg-amber-600 hover:bg-amber-700 shrink-0' : 'shrink-0'}
          >
            <IndianRupee className="mr-1 h-4 w-4" />
            {collectionsFirst ? 'Show all customers' : 'Show pending payments'}
          </Button>
        </div>
      </div>

      {/* Filters — hidden in collections view, which has its own fixed ordering */}
      {!collectionsFirst && (
        <CustomerFilters
          onDateFilter={handleDateFilter}
          onTypeFilter={handleTypeFilter}
          onPaymentStatusFilter={handlePaymentStatusFilter}
          onSearch={handleSearch}
          onSortChange={handleSortChange}
          searchTerm={searchTerm}
          loading={loading || enrichingCustomers}
        />
      )}

      {collectionsFirst && (
        <FilterPanel
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search pending customers by name or phone…"
          summary={`${filteredCustomers.length} customer${filteredCustomers.length === 1 ? '' : 's'} with a pending balance, oldest first`}
        />
      )}

      {/* Balances are computed after the first paint, so say so rather than showing an
          empty collections list that looks like "nobody owes anything". */}
      {collectionsFirst && enrichingCustomers && filteredCustomers.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"
            />
          ))}
        </div>
      ) : viewMode === 'grid' ? (
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

      {/* Duplicate customer merge */}
      <CustomerDuplicatesDialog
        customers={customers}
        open={duplicatesOpen}
        onOpenChange={setDuplicatesOpen}
        onMerged={() => setDuplicatesOpen(false)}
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
