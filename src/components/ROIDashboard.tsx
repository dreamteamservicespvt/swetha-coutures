import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency } from '@/utils/billingUtils';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { CalendarIcon, TrendingUp, Package, DollarSign, RefreshCw, FileText, Plus, Pencil, GitMerge, Trash2, X, ShoppingBag } from 'lucide-react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import QuickRangeToggle, { QuickRange } from '@/components/QuickRangeToggle';
import { isInRange, getTotalBilling, toJsDate, FinanceDateRange } from '@/utils/financeReports';
import { fetchCollectionCached } from '@/utils/firestoreCache';
import CatalogManageDialog, { CatalogMode } from '@/components/roi/CatalogManageDialog';
import { CatalogKind } from '@/utils/catalogManagement';

// Staff interface for ROI calculations
interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  department: string;
  skills?: string[];
  status?: 'active' | 'inactive';
  joinDate?: any;
  salary?: number;
  address?: string;
  upiId?: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  salaryAmount?: number;
  salaryMode?: 'monthly' | 'hourly' | 'daily';
  // New salary fields
  paidSalary?: number;
  bonus?: number;
  billingRate?: number;
  emergencyContact?: {
    name: string;
    phone: string;
    relation: string;
  };
  createdAt?: any;
}

// ROI calculation interfaces
interface StaffROI {
  staffId: string;
  staffName: string;
  staffRole: string;
  totalBilled: number;
  salaryAmount: number;
  netROI: number;
  roiPercentage: number;
  ordersCount: number;
  billingRate?: number;
}

interface InventoryROI {
  itemId: string;
  itemName: string;
  category: string;
  totalCost: number;
  totalSold: number;
  netROI: number;
  roiPercentage: number;
  unitsSold: number;
  avgSellingPrice: number;
}

// New interface for Services ROI
interface ServiceROI {
  serviceName: string;
  totalIncome: number;
  timesUsed: number;
  avgPrice: number;
  relatedOrders: ServiceUsage[];
  relatedBills: ServiceUsage[];
}

// New interface for Products ROI
interface ProductROI {
  productName: string;
  totalIncome: number;
  timesUsed: number;
  avgPrice: number;
  relatedOrders: ProductUsage[];
  relatedBills: ProductUsage[];
}

interface ServiceUsage {
  id: string;
  orderId?: string;
  billId?: string;
  customerName: string;
  date: any;
  amount: number;
  productName?: string;
}

interface ProductUsage {
  id: string;
  orderId?: string;
  billId?: string;
  customerName: string;
  date: any;
  amount: number;
  description?: string;
  productName?: string;
}

/**
 * Goods sold over the counter — a bill product or sub-item the admin ticked
 * "Sold from store". Shaped like ProductROI so the same card/drill-down renders it.
 */
interface SaleROI {
  productName: string;
  totalIncome: number;
  timesUsed: number;
  qtySold: number;
  avgPrice: number;
  relatedOrders: ProductUsage[];
  relatedBills: ProductUsage[];
}

interface ROIMetrics {
  totalStaffROI: number;
  totalInventoryROI: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
}

const ROIDashboard: React.FC = () => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);

  // Quick date range — Career / This Month / Today, defaults to This Month
  const [quickRange, setQuickRange] = useState<QuickRange>('month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const hasCustom = !!(customStart && customEnd);

  // Date range as JS Dates (custom overrides the toggle)
  const dateRange = useMemo(() => {
    if (hasCustom) return { start: startOfDay(customStart!), end: endOfDay(customEnd!) };
    const now = new Date();
    if (quickRange === 'today') return { start: startOfDay(now), end: endOfDay(now) };
    if (quickRange === 'month') return { start: startOfMonth(now), end: endOfMonth(now) };
    return { start: new Date(0), end: endOfDay(now) }; // career = all-time
  }, [quickRange, customStart, customEnd, hasCustom]);

  // FinanceDateRange (Timestamps | null) for the shared client-side date filter
  const fdRange = useMemo<FinanceDateRange>(() => {
    if (quickRange === 'career' && !hasCustom) return null;
    return { start: Timestamp.fromDate(dateRange.start), end: Timestamp.fromDate(dateRange.end) };
  }, [quickRange, hasCustom, dateRange]);

  const periodLabel = hasCustom
    ? 'Selected dates'
    : quickRange === 'career' ? 'Career (all time)' : quickRange === 'today' ? 'Today' : 'This Month';

  const [selectedTab, setSelectedTab] = useState<'overview' | 'services' | 'products' | 'sales'>('products');

  // Data states
  const [servicesROI, setServicesROI] = useState<ServiceROI[]>([]);
  const [productsROI, setProductsROI] = useState<ProductROI[]>([]);
  const [salesROI, setSalesROI] = useState<SaleROI[]>([]);
  const [totalBilling, setTotalBilling] = useState(0);
  const [selectedService, setSelectedService] = useState<ServiceROI | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductROI | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  // Pagination states for drill-down modals
  const [serviceBillsPage, setServiceBillsPage] = useState(1);
  const [serviceOrdersPage, setServiceOrdersPage] = useState(1);
  const [productBillsPage, setProductBillsPage] = useState(1);
  const [productOrdersPage, setProductOrdersPage] = useState(1);
  const itemsPerPage = 50;

  // Catalog management dialog state
  const [manageOpen, setManageOpen] = useState(false);
  const [manageKind, setManageKind] = useState<CatalogKind>('service');
  const [manageMode, setManageMode] = useState<CatalogMode>('create');
  const [manageSource, setManageSource] = useState<string>('');

  const openManage = (kind: CatalogKind, mode: CatalogMode, source = '') => {
    setManageKind(kind);
    setManageMode(mode);
    setManageSource(source);
    setManageOpen(true);
  };

  const clearAllFilters = () => {
    setQuickRange('month');
    setCustomStart(undefined);
    setCustomEnd(undefined);
  };

  // Safe date formatter — never throws on string/missing/invalid dates (date-fns format() would)
  const safeFormatDate = (d: any): string => {
    const date = toJsDate(d);
    if (!date || isNaN(date.getTime()) || date.getTime() === 0) return 'No date';
    return format(date, 'MMM dd, yyyy');
  };

  if (userData?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Access Denied</h3>
          <p className="text-gray-500 dark:text-gray-400">ROI Dashboard is only available to administrators.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchROIData();
  }, [dateRange]);

  const fetchROIData = async () => {
    setLoading(true);
    try {
      const [, , , billing] = await Promise.all([
        calculateServicesROI(),
        calculateProductsROI(),
        calculateSalesROI(),
        getTotalBilling(fdRange),
      ]);
      setTotalBilling(billing);
    } catch (error) {
      console.error('Error fetching ROI data:', error);
      toast({
        title: "Error",
        description: "Failed to load ROI data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateServicesROI = async () => {
    try {
      // Fetch all, filter client-side so string + Timestamp dates are both counted
      const [billDocs, orderDocs] = await Promise.all([
        fetchCollectionCached('bills'),
        fetchCollectionCached('orders'),
      ]);
      const bills = billDocs
        .map(doc => ({ id: doc.id, ...doc.data }))
        .filter((b: any) => isInRange(b.date || b.createdAt, fdRange)) as any[];

      const orders = orderDocs
        .map(doc => ({ id: doc.id, ...doc.data }))
        .filter((o: any) => isInRange(o.createdAt || o.date, fdRange)) as any[];

      const servicesMap = new Map<string, ServiceROI>();

      // Process bills
      bills.forEach((bill: any) => {
        const processedServices = new Set<string>(); // Track services already processed for this bill
        
        // Process new product structure first (preferred format)
        let hasNewStructure = false;
        if (bill.products && Array.isArray(bill.products)) {
          bill.products.forEach((product: any) => {
            if (product.descriptions && Array.isArray(product.descriptions)) {
              hasNewStructure = true;
              product.descriptions.forEach((desc: any) => {
                if (desc.description) {
                  const serviceName = desc.description.trim();
                  const serviceKey = `${bill.id}-${serviceName}`; // Unique key per bill
                  
                  if (!processedServices.has(serviceKey)) {
                    processedServices.add(serviceKey);
                    
                    const existing = servicesMap.get(serviceName) || {
                      serviceName,
                      totalIncome: 0,
                      timesUsed: 0,
                      avgPrice: 0,
                      relatedOrders: [],
                      relatedBills: []
                    };

                    existing.totalIncome += desc.amount || 0;
                    existing.timesUsed += 1;
                    existing.relatedBills.push({
                      id: bill.id,
                      billId: bill.billId,
                      customerName: bill.customerName,
                      date: bill.date,
                      amount: desc.amount || 0,
                      productName: product.name
                    });

                    servicesMap.set(serviceName, existing);
                  }
                }
              });
            }
          });
        }

        // Process legacy items structure only if new structure doesn't exist
        if (!hasNewStructure && bill.items && Array.isArray(bill.items)) {
          bill.items.forEach((item: any) => {
            if (item.description) {
              const serviceName = item.description.trim();
              const serviceKey = `${bill.id}-${serviceName}`; // Unique key per bill
              
              if (!processedServices.has(serviceKey)) {
                processedServices.add(serviceKey);
                
                const existing = servicesMap.get(serviceName) || {
                  serviceName,
                  totalIncome: 0,
                  timesUsed: 0,
                  avgPrice: 0,
                  relatedOrders: [],
                  relatedBills: []
                };

                existing.totalIncome += item.amount || 0;
                existing.timesUsed += 1;
                existing.relatedBills.push({
                  id: bill.id,
                  billId: bill.billId,
                  customerName: bill.customerName,
                  date: bill.date,
                  amount: item.amount || 0
                });

                servicesMap.set(serviceName, existing);
              }
            }
          });
        }
      });

      // Process orders - Only for tracking, don't double count income
      // Orders are processed to show related order data but don't contribute to totalIncome 
      // to avoid double counting since bills are the final invoiced amounts
      orders.forEach((order: any) => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const serviceName = (item.description || item.category || item.type || 'Unknown Service').trim();
            const existing = servicesMap.get(serviceName);
            
            // Only add to related orders if this service already exists from bills
            // This prevents counting services that only exist in orders but not in bills
            if (existing) {
              existing.relatedOrders.push({
                id: order.id,
                orderId: order.orderId || order.id,
                customerName: order.customerName,
                date: order.date || order.createdAt,
                amount: item.amount || 0
              });
              
              servicesMap.set(serviceName, existing);
            }
          });
        }
      });

      // Calculate average prices and sort by total income
      const servicesROIData: ServiceROI[] = Array.from(servicesMap.values()).map(service => ({
        ...service,
        avgPrice: service.timesUsed > 0 ? service.totalIncome / service.timesUsed : 0
      })).sort((a, b) => b.totalIncome - a.totalIncome);

      setServicesROI(servicesROIData);
    } catch (error) {
      console.error('Error calculating services ROI:', error);
    }
  };

  const calculateProductsROI = async () => {
    try {
      // Fetch all, filter client-side so string + Timestamp dates are both counted
      const [allBills, allOrders] = await Promise.all([
        fetchCollectionCached('bills'),
        fetchCollectionCached('orders'),
      ]);
      const billDocs = allBills.filter(d => isInRange(d.data.date || d.data.createdAt, fdRange));
      const orderDocs = allOrders.filter(d => isInRange(d.data.createdAt || d.data.date, fdRange));

      const productsMap = new Map<string, ProductROI>();

      // Process bills data - Group by PRODUCT NAME only, not by descriptions
      billDocs.forEach(doc => {
        const bill = doc.data;
        if (bill.products && Array.isArray(bill.products)) {
          bill.products.forEach((product: any) => {
            const productName = (product.name || 'Unknown Product').trim();
            
            const existing = productsMap.get(productName) || {
              productName,
              totalIncome: 0,
              timesUsed: 0,
              avgPrice: 0,
              relatedOrders: [],
              relatedBills: []
            };

            // Sum up all descriptions under this product
            const productTotal = product.total || 0;
            existing.totalIncome += productTotal;
            existing.timesUsed += 1;

            existing.relatedBills.push({
              id: bill.id || doc.id,
              billId: bill.billId || bill.id || doc.id,
              customerName: bill.customerName,
              date: bill.date || bill.createdAt,
              amount: productTotal,
              description: `${productName} (Total)`
            });

            productsMap.set(productName, existing);
          });
        }
      });

      // Process orders data - Group by PRODUCT NAME only, not by descriptions
      orderDocs.forEach(doc => {
        const order = doc.data;
        if (order.products && Array.isArray(order.products)) {
          order.products.forEach((product: any) => {
            const productName = (product.name || 'Unknown Product').trim();
            
            const existing = productsMap.get(productName) || {
              productName,
              totalIncome: 0,
              timesUsed: 0,
              avgPrice: 0,
              relatedOrders: [],
              relatedBills: []
            };

            const productTotal = product.total || 0;

            existing.relatedOrders.push({
              id: order.id,
              orderId: order.orderId || order.id,
              customerName: order.customerName,
              date: order.date || order.createdAt,
              amount: productTotal,
              description: `${productName} (Total)`
            });

            productsMap.set(productName, existing);
          });
        }
      });

      // Calculate average prices and sort by total income
      const productsROIData: ProductROI[] = Array.from(productsMap.values()).map(product => ({
        ...product,
        avgPrice: product.timesUsed > 0 ? product.totalIncome / product.timesUsed : 0
      })).sort((a, b) => b.totalIncome - a.totalIncome);

      setProductsROI(productsROIData);
    } catch (error) {
      console.error('Error calculating products ROI:', error);
    }
  };

  /**
   * Store sales — bill products (or individual sub-items) flagged "Sold from store".
   *
   * A product flagged as a sale contributes its whole total and its sub-items are not
   * counted again; otherwise only the individually flagged sub-items count. This mirrors
   * how the billing form presents the two checkboxes, so a figure can never be double-counted.
   */
  const calculateSalesROI = async () => {
    try {
      const allBills = await fetchCollectionCached('bills');
      const billDocs = allBills.filter((d) =>
        isInRange(d.data.date || d.data.createdAt, fdRange)
      );

      const salesMap = new Map<string, SaleROI>();

      const addSale = (
        name: string,
        amount: number,
        qty: number,
        bill: any,
        docId: string,
        description?: string
      ) => {
        const key = name.trim() || 'Unnamed item';
        const existing = salesMap.get(key) || {
          productName: key,
          totalIncome: 0,
          timesUsed: 0,
          qtySold: 0,
          avgPrice: 0,
          relatedOrders: [],
          relatedBills: [],
        };

        existing.totalIncome += amount || 0;
        existing.timesUsed += 1;
        existing.qtySold += qty || 0;
        existing.relatedBills.push({
          id: bill.id || docId,
          billId: bill.billId || docId,
          customerName: bill.customerName,
          date: bill.date || bill.createdAt,
          amount: amount || 0,
          description,
        });

        salesMap.set(key, existing);
      };

      billDocs.forEach((docSnap) => {
        const bill = docSnap.data;
        if (!Array.isArray(bill.products)) return;

        bill.products.forEach((product: any) => {
          const descriptions = Array.isArray(product.descriptions) ? product.descriptions : [];

          if (product.isSale) {
            // The product is the sale, but only its *ticked* sub-items count — that is how
            // "mark the product, then untick the one line that was stitching work" is honoured.
            // Bills saved before per-item flags existed have none set, so all lines count.
            const anyFlagSet = descriptions.some((d: any) => d.isSale !== undefined);
            const counted = anyFlagSet
              ? descriptions.filter((d: any) => d.isSale)
              : descriptions;

            const amount =
              descriptions.length === 0
                ? product.total || 0
                : counted.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
            const qty = counted.reduce((sum: number, d: any) => sum + (d.qty || 0), 0);

            if (amount > 0) {
              const excluded = descriptions.length - counted.length;
              addSale(
                product.name || 'Unknown Product',
                amount,
                qty,
                bill,
                docSnap.id,
                excluded > 0
                  ? `Sold from store (${excluded} item${excluded === 1 ? '' : 's'} excluded)`
                  : 'Whole product sold from store'
              );
            }
            return;
          }

          descriptions
            .filter((desc: any) => desc.isSale)
            .forEach((desc: any) => {
              addSale(
                desc.description || product.name || 'Unknown Item',
                desc.amount || 0,
                desc.qty || 0,
                bill,
                docSnap.id,
                product.name ? `Under ${product.name}` : undefined
              );
            });
        });
      });

      setSalesROI(
        Array.from(salesMap.values())
          .map((sale) => ({
            ...sale,
            avgPrice: sale.timesUsed > 0 ? sale.totalIncome / sale.timesUsed : 0,
          }))
          .sort((a, b) => b.totalIncome - a.totalIncome)
      );
    } catch (error) {
      console.error('Error calculating sales ROI:', error);
    }
  };

  // Derived totals for the working (Services / Products) data
  const totalServicesIncome = servicesROI.reduce((sum, s) => sum + s.totalIncome, 0);
  const totalProductsIncome = productsROI.reduce((sum, p) => sum + p.totalIncome, 0);
  const totalSalesIncome = salesROI.reduce((sum, s) => sum + s.totalIncome, 0);
  const totalSalesQty = salesROI.reduce((sum, s) => sum + s.qtySold, 0);
  const serviceNames = servicesROI.map((s) => s.serviceName);
  const productNames = productsROI.map((p) => p.productName);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ROI Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Service &amp; product performance — manage your billing catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchROIData}
            disabled={loading}
            className="btn-responsive"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters & Date Range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base sm:text-lg">
            <span className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-purple-600" />
              Filters &amp; Date Range
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              disabled={quickRange === 'month' && !hasCustom}
            >
              <X className="h-4 w-4 mr-1" />
              Clear all
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick view toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick view:</span>
            <QuickRangeToggle value={quickRange} onChange={setQuickRange} muted={hasCustom} />
            {hasCustom && (
              <span className="text-xs text-amber-600 dark:text-amber-400">Custom dates active — overrides quick view</span>
            )}
          </div>

          {/* Custom date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end border-t border-gray-100 dark:border-gray-700 pt-4">
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400">From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStart ? format(customStart, 'PPP') : 'Start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400">To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEnd ? format(customEnd, 'PPP') : 'End date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            {hasCustom && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setCustomStart(undefined); setCustomEnd(undefined); }}
                className="text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Clear dates
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <DollarSign className="h-5 w-5 text-green-600" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(totalBilling)}</div>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <FileText className="h-5 w-5 text-blue-600" />
              Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-blue-600">{servicesROI.length}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(totalServicesIncome)} income</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Package className="h-5 w-5 text-purple-600" />
              Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-purple-600">{productsROI.length}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(totalProductsIncome)} income</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <ShoppingBag className="h-5 w-5 text-amber-600" />
              Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-amber-600">{formatCurrency(totalSalesIncome)}</div>
            <p className="text-xs text-muted-foreground">
              {salesROI.length} item{salesROI.length === 1 ? '' : 's'} sold from store
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services ({servicesROI.length})</TabsTrigger>
          <TabsTrigger value="products">Products ({productsROI.length})</TabsTrigger>
          <TabsTrigger value="sales">Sales ({salesROI.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                {periodLabel}
                {quickRange !== 'career' || hasCustom ? ` · ${format(dateRange.start, 'PP')} – ${format(dateRange.end, 'PP')}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" /> Top Services
                  </h4>
                  <div className="space-y-2">
                    {servicesROI.slice(0, 5).map((s) => (
                      <div key={s.serviceName} className="flex justify-between text-sm">
                        <span className="truncate">{s.serviceName}</span>
                        <span className="font-medium text-green-600 ml-2 flex-shrink-0">{formatCurrency(s.totalIncome)}</span>
                      </div>
                    ))}
                    {servicesROI.length === 0 && <p className="text-sm text-gray-500">No services in this period.</p>}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-600" /> Top Products
                  </h4>
                  <div className="space-y-2">
                    {productsROI.slice(0, 5).map((p) => (
                      <div key={p.productName} className="flex justify-between text-sm">
                        <span className="truncate">{p.productName}</span>
                        <span className="font-medium text-green-600 ml-2 flex-shrink-0">{formatCurrency(p.totalIncome)}</span>
                      </div>
                    ))}
                    {productsROI.length === 0 && <p className="text-sm text-gray-500">No products in this period.</p>}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-amber-600" /> Top Sales
                  </h4>
                  <div className="space-y-2">
                    {salesROI.slice(0, 5).map((s) => (
                      <div key={s.productName} className="flex justify-between text-sm">
                        <span className="truncate">{s.productName}</span>
                        <span className="font-medium text-amber-600 ml-2 flex-shrink-0">{formatCurrency(s.totalIncome)}</span>
                      </div>
                    ))}
                    {salesROI.length === 0 && <p className="text-sm text-gray-500">No store sales in this period.</p>}
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <p>• Total revenue ({periodLabel}): <b>{formatCurrency(totalBilling)}</b></p>
                  <p>• {servicesROI.length} distinct services · {productsROI.length} distinct products · {formatCurrency(totalSalesIncome)} sold from store</p>
                  <p>• Use the Services / Products tabs to add, rename, merge or delete catalog entries.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">{servicesROI.length} service(s) · {periodLabel}</p>
            <Button size="sm" onClick={() => openManage('service', 'create')} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <Plus className="h-4 w-4 mr-1" /> Add Service
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servicesROI.map((service) => (
                <Card key={service.serviceName} className="hover:shadow-md transition-shadow">
                  <CardHeader
                    className="pb-3 cursor-pointer"
                    onClick={() => {
                      setSelectedService(service);
                      setServiceBillsPage(1);
                      setServiceOrdersPage(1);
                      setShowServiceModal(true);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{service.serviceName}</CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Total Income: {formatCurrency(service.totalIncome)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">{service.timesUsed} uses</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Avg Price</span>
                        <div className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(service.avgPrice)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Bills / Orders</span>
                        <div className="font-medium text-green-600 dark:text-green-400">{service.relatedBills.length} / {service.relatedOrders.length}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => openManage('service', 'rename', service.serviceName)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />Rename
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => openManage('service', 'merge', service.serviceName)}>
                        <GitMerge className="h-3.5 w-3.5 mr-1" />Merge
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => openManage('service', 'delete', service.serviceName)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {servicesROI.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <FileText className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Services Data</h3>
                  <p className="text-gray-600 dark:text-gray-400">No services in {periodLabel}. Use "Add Service" to create one.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">{productsROI.length} product(s) · {periodLabel}</p>
            <Button size="sm" onClick={() => openManage('product', 'create')} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productsROI.map((product) => (
                <Card key={product.productName} className="hover:shadow-md transition-shadow">
                  <CardHeader
                    className="pb-3 cursor-pointer"
                    onClick={() => {
                      setSelectedProduct(product);
                      setProductBillsPage(1);
                      setProductOrdersPage(1);
                      setShowProductModal(true);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{product.productName}</CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Total Income: {formatCurrency(product.totalIncome)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">{product.timesUsed} uses</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Avg Price</span>
                        <div className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(product.avgPrice)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Bills / Orders</span>
                        <div className="font-medium text-green-600 dark:text-green-400">{product.relatedBills.length} / {product.relatedOrders.length}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => openManage('product', 'rename', product.productName)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />Rename
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => openManage('product', 'merge', product.productName)}>
                        <GitMerge className="h-3.5 w-3.5 mr-1" />Merge
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => openManage('product', 'delete', product.productName)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {productsROI.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Package className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Products Data</h3>
                  <p className="text-gray-600 dark:text-gray-400">No products in {periodLabel}. Use "Add Product" to create one.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Sales — goods sold over the counter, flagged on the bill (Req 2) */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {salesROI.length} item{salesROI.length === 1 ? '' : 's'} · {totalSalesQty} unit
              {totalSalesQty === 1 ? '' : 's'} · {periodLabel}
            </p>
            <p className="text-sm font-semibold text-amber-600">
              Total sales: {formatCurrency(totalSalesIncome)}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : salesROI.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Sales Yet</h3>
              <p className="mx-auto max-w-md text-gray-600 dark:text-gray-400">
                On a bill, tick <b>“Sold from store”</b> on a product or a sub-item and it will be
                counted here as a sale for {periodLabel.toLowerCase()}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {salesROI.map((sale) => (
                <Card
                  key={sale.productName}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedProduct({
                      productName: sale.productName,
                      totalIncome: sale.totalIncome,
                      timesUsed: sale.timesUsed,
                      avgPrice: sale.avgPrice,
                      relatedBills: sale.relatedBills,
                      relatedOrders: sale.relatedOrders,
                    });
                    setProductBillsPage(1);
                    setProductOrdersPage(1);
                    setShowProductModal(true);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{sale.productName}</CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Sales: {formatCurrency(sale.totalIncome)}
                        </p>
                      </div>
                      <Badge className="flex-shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {sale.qtySold} sold
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Avg Price</span>
                        <div className="font-medium text-blue-600 dark:text-blue-400">
                          {formatCurrency(sale.avgPrice)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Bills</span>
                        <div className="font-medium text-green-600 dark:text-green-400">
                          {sale.relatedBills.length}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Service Detail Modal */}
      {selectedService && showServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedService.serviceName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Service Performance Analysis
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowServiceModal(false)}
                  className="flex items-center gap-2"
                >
                  Close
                </Button>
              </div>

              {/* Service Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Total Income</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(selectedService.totalIncome)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Times Used</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedService.timesUsed}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Average Price</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(selectedService.avgPrice)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bills and Orders Lists */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Related Bills */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Related Bills ({selectedService.relatedBills.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const totalBills = selectedService.relatedBills.length;
                      const totalPages = Math.ceil(totalBills / itemsPerPage);
                      const startIndex = (serviceBillsPage - 1) * itemsPerPage;
                      const endIndex = Math.min(startIndex + itemsPerPage, totalBills);
                      const currentBills = selectedService.relatedBills.slice(startIndex, endIndex);

                      return (
                        <>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {currentBills.map((bill, index) => (
                              <div key={`bill-${startIndex + index}`} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium">{bill.billId || bill.id}</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      {bill.customerName}
                                    </div>
                                    {bill.productName && (
                                      <div className="text-xs text-blue-600 dark:text-blue-400">
                                        Product: {bill.productName}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium text-green-600">
                                      {formatCurrency(bill.amount)}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {safeFormatDate(bill.date)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {totalBills === 0 && (
                              <p className="text-gray-500 text-center py-4">No bills found</p>
                            )}
                          </div>
                          
                          {/* Pagination for Bills */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Showing {startIndex + 1}-{endIndex} of {totalBills} bills
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setServiceBillsPage(p => Math.max(1, p - 1))}
                                  disabled={serviceBillsPage === 1}
                                >
                                  Previous
                                </Button>
                                <span className="text-sm">
                                  Page {serviceBillsPage} of {totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setServiceBillsPage(p => Math.min(totalPages, p + 1))}
                                  disabled={serviceBillsPage === totalPages}
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Related Orders */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Related Orders ({selectedService.relatedOrders.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const totalOrders = selectedService.relatedOrders.length;
                      const totalPages = Math.ceil(totalOrders / itemsPerPage);
                      const startIndex = (serviceOrdersPage - 1) * itemsPerPage;
                      const endIndex = Math.min(startIndex + itemsPerPage, totalOrders);
                      const currentOrders = selectedService.relatedOrders.slice(startIndex, endIndex);

                      return (
                        <>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {currentOrders.map((order, index) => (
                              <div key={`order-${startIndex + index}`} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium">{order.orderId}</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      {order.customerName}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium text-blue-600">
                                      {formatCurrency(order.amount)}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {safeFormatDate(order.date)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {totalOrders === 0 && (
                              <p className="text-gray-500 text-center py-4">No orders found</p>
                            )}
                          </div>
                          
                          {/* Pagination for Orders */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Showing {startIndex + 1}-{endIndex} of {totalOrders} orders
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setServiceOrdersPage(p => Math.max(1, p - 1))}
                                  disabled={serviceOrdersPage === 1}
                                >
                                  Previous
                                </Button>
                                <span className="text-sm">
                                  Page {serviceOrdersPage} of {totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setServiceOrdersPage(p => Math.min(totalPages, p + 1))}
                                  disabled={serviceOrdersPage === totalPages}
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedProduct.productName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Product Performance Analysis
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowProductModal(false)}
                  className="flex items-center gap-2"
                >
                  Close
                </Button>
              </div>

              {/* Product Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Total Income</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(selectedProduct.totalIncome)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Times Used</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedProduct.timesUsed}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Average Price</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(selectedProduct.avgPrice)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bills and Orders Lists */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Related Bills */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Related Bills ({selectedProduct.relatedBills.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const totalBills = selectedProduct.relatedBills.length;
                      const totalPages = Math.ceil(totalBills / itemsPerPage);
                      const startIndex = (productBillsPage - 1) * itemsPerPage;
                      const endIndex = Math.min(startIndex + itemsPerPage, totalBills);
                      const currentBills = selectedProduct.relatedBills.slice(startIndex, endIndex);

                      return (
                        <>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {currentBills.map((bill, index) => (
                              <div key={`bill-${startIndex + index}`} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium">{bill.billId || bill.id}</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      {bill.customerName}
                                    </div>
                                    {bill.description && (
                                      <div className="text-xs text-blue-600 dark:text-blue-400">
                                        {bill.description}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium text-green-600">
                                      {formatCurrency(bill.amount)}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {safeFormatDate(bill.date)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {totalBills === 0 && (
                              <p className="text-gray-500 text-center py-4">No bills found</p>
                            )}
                          </div>
                          
                          {/* Pagination for Bills */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Showing {startIndex + 1}-{endIndex} of {totalBills} bills
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setProductBillsPage(p => Math.max(1, p - 1))}
                                  disabled={productBillsPage === 1}
                                >
                                  Previous
                                </Button>
                                <span className="text-sm">
                                  Page {productBillsPage} of {totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setProductBillsPage(p => Math.min(totalPages, p + 1))}
                                  disabled={productBillsPage === totalPages}
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Related Orders */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Related Orders ({selectedProduct.relatedOrders.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const totalOrders = selectedProduct.relatedOrders.length;
                      const totalPages = Math.ceil(totalOrders / itemsPerPage);
                      const startIndex = (productOrdersPage - 1) * itemsPerPage;
                      const endIndex = Math.min(startIndex + itemsPerPage, totalOrders);
                      const currentOrders = selectedProduct.relatedOrders.slice(startIndex, endIndex);

                      return (
                        <>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {currentOrders.map((order, index) => (
                              <div key={`order-${startIndex + index}`} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium">{order.orderId}</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      {order.customerName}
                                    </div>
                                    {order.description && (
                                      <div className="text-xs text-blue-600 dark:text-blue-400">
                                        {order.description}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium text-blue-600">
                                      {formatCurrency(order.amount)}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {safeFormatDate(order.date)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {totalOrders === 0 && (
                              <p className="text-gray-500 text-center py-4">No orders found</p>
                            )}
                          </div>
                          
                          {/* Pagination for Orders */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Showing {startIndex + 1}-{endIndex} of {totalOrders} orders
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setProductOrdersPage(p => Math.max(1, p - 1))}
                                  disabled={productOrdersPage === 1}
                                >
                                  Previous
                                </Button>
                                <span className="text-sm">
                                  Page {productOrdersPage} of {totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setProductOrdersPage(p => Math.min(totalPages, p + 1))}
                                  disabled={productOrdersPage === totalPages}
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catalog management dialog (create / rename / merge / delete) */}
      <CatalogManageDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        kind={manageKind}
        mode={manageMode}
        sourceName={manageSource}
        existingNames={manageKind === 'service' ? serviceNames : productNames}
        onDone={fetchROIData}
      />
    </div>
  );
};

export default ROIDashboard;
