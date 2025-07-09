import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency } from '@/utils/billingUtils';
import { useAuth } from '@/contexts/AuthContext';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { CalendarIcon, TrendingUp, TrendingDown, Users, Package, DollarSign, BarChart3, Download, Filter, RefreshCw, FileText } from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

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
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(subMonths(new Date(), 1)),
    end: endOfMonth(new Date())
  });
  const [selectedTab, setSelectedTab] = useState<'staff' | 'inventory' | 'services' | 'products' | 'overview'>('products');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Data states
  const [staffROI, setStaffROI] = useState<StaffROI[]>([]);
  const [inventoryROI, setInventoryROI] = useState<InventoryROI[]>([]);
  const [servicesROI, setServicesROI] = useState<ServiceROI[]>([]);
  const [productsROI, setProductsROI] = useState<ProductROI[]>([]);
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
  const [metrics, setMetrics] = useState<ROIMetrics>({
    totalStaffROI: 0,
    totalInventoryROI: 0,
    totalRevenue: 0,
    totalCosts: 0,
    netProfit: 0,
    profitMargin: 0
  });

  // Helper function to calculate monthly salary based on new logic
  const calculateMonthlySalary = (staff: StaffMember) => {
    const paidSalary = staff.paidSalary || 0;
    const bonus = staff.bonus || 0;
    const actualSalary = staff.salaryAmount || staff.salary || 0;
    
    // If both paid salary and bonus are entered, use their sum
    if (paidSalary > 0 && bonus > 0) {
      return paidSalary + bonus;
    }
    // If only paid salary is entered, use it
    if (paidSalary > 0) {
      return paidSalary;
    }
    // Otherwise, use actual salary
    return actualSalary;
  };

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

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
      await Promise.all([
        calculateStaffROI(),
        calculateInventoryROI(),
        calculateServicesROI(),
        calculateProductsROI(),
        fetchFiltersData()
      ]);
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

  const calculateStaffROI = async () => {
    try {
      // Fetch staff data
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const staff: StaffMember[] = staffSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as StaffMember));
      
      // Fetch bills in date range
      const billsQuery = query(
        collection(db, 'bills'),
        where('createdAt', '>=', dateRange.start),
        where('createdAt', '<=', dateRange.end)
      );
      const billsSnapshot = await getDocs(billsQuery);
      const bills = billsSnapshot.docs.map(doc => doc.data());

      const staffROIData: StaffROI[] = [];
      
      for (const staffMember of staff) {
        let totalBilled = 0;
        let ordersCount = 0;

        // Calculate billing from bills where staff was involved
        bills.forEach(bill => {
          if (bill.items) {
            bill.items.forEach((item: any) => {
              if (item.type === 'staff' && item.sourceId === staffMember.id) {
                totalBilled += item.amount || 0;
                ordersCount++;
              }
            });
          }
        });

        const salaryAmount = calculateMonthlySalary(staffMember);
        const netROI = totalBilled - salaryAmount;
        const roiPercentage = salaryAmount > 0 ? (netROI / salaryAmount) * 100 : 0;

        if (totalBilled > 0 || salaryAmount > 0) {
          staffROIData.push({
            staffId: staffMember.id,
            staffName: staffMember.name || 'Unknown',
            staffRole: staffMember.role || 'Staff',
            totalBilled,
            salaryAmount,
            netROI,
            roiPercentage,
            ordersCount,
            billingRate: staffMember.billingRate || 0
          });
        }
      }

      setStaffROI(staffROIData.sort((a, b) => b.roiPercentage - a.roiPercentage));
    } catch (error) {
      console.error('Error calculating staff ROI:', error);
    }
  };

  const calculateInventoryROI = async () => {
    try {
      // Fetch bills in date range
      const billsQuery = query(
        collection(db, 'bills'),
        where('createdAt', '>=', dateRange.start),
        where('createdAt', '<=', dateRange.end)
      );
      const billsSnapshot = await getDocs(billsQuery);
      const bills = billsSnapshot.docs.map(doc => doc.data());

      const inventoryMap = new Map<string, any>();

      // Calculate inventory ROI from bills
      bills.forEach(bill => {
        if (bill.items) {
          bill.items.forEach((item: any) => {
            if (item.type === 'inventory' && item.sourceId) {
              const existing = inventoryMap.get(item.sourceId) || {
                itemId: item.sourceId,
                itemName: item.description || 'Unknown Item',
                category: item.category || 'Uncategorized',
                totalCost: 0,
                totalSold: 0,
                unitsSold: 0
              };

              existing.totalCost += (item.cost || 0) * (item.quantity || 1);
              existing.totalSold += item.amount || 0;
              existing.unitsSold += item.quantity || 1;

              inventoryMap.set(item.sourceId, existing);
            }
          });
        }
      });

      const inventoryROIData: InventoryROI[] = Array.from(inventoryMap.values()).map(item => {
        const netROI = item.totalSold - item.totalCost;
        const roiPercentage = item.totalCost > 0 ? (netROI / item.totalCost) * 100 : 0;
        const avgSellingPrice = item.unitsSold > 0 ? item.totalSold / item.unitsSold : 0;

        return {
          ...item,
          netROI,
          roiPercentage,
          avgSellingPrice
        };
      }).sort((a, b) => b.roiPercentage - a.roiPercentage);

      setInventoryROI(inventoryROIData);
    } catch (error) {
      console.error('Error calculating inventory ROI:', error);
    }
  };

  const calculateServicesROI = async () => {
    try {
      // Fetch bills in date range
      const billsQuery = query(
        collection(db, 'bills'),
        where('createdAt', '>=', dateRange.start),
        where('createdAt', '<=', dateRange.end)
      );
      const billsSnapshot = await getDocs(billsQuery);
      const bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      // Fetch orders in date range
      const ordersQuery = query(
        collection(db, 'orders'),
        where('createdAt', '>=', dateRange.start),
        where('createdAt', '<=', dateRange.end)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

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
      // Fetch bills data
      const billsSnapshot = await getDocs(
        query(
          collection(db, 'bills'),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end),
          orderBy('date', 'desc')
        )
      );

      // Fetch orders data
      const ordersSnapshot = await getDocs(
        query(
          collection(db, 'orders'),
          where('createdAt', '>=', dateRange.start),
          where('createdAt', '<=', dateRange.end),
          orderBy('createdAt', 'desc')
        )
      );

      const productsMap = new Map<string, ProductROI>();

      // Process bills data - Group by PRODUCT NAME only, not by descriptions
      billsSnapshot.docs.forEach(doc => {
        const bill = doc.data();
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
      ordersSnapshot.docs.forEach(doc => {
        const order = doc.data();
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

  const fetchFiltersData = async () => {
    try {
      // Fetch staff for filters
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const staff: StaffMember[] = staffSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as StaffMember));
      setStaffList(staff);

      // Extract unique departments
      const uniqueDepartments = [...new Set(staff.map(s => s.department).filter(Boolean))];
      setDepartments(uniqueDepartments);

      // Fetch inventory categories
      const inventorySnapshot = await getDocs(collection(db, 'inventory'));
      const inventory = inventorySnapshot.docs.map(doc => doc.data());
      const uniqueCategories = [...new Set(inventory.map((i: any) => i.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching filters data:', error);
    }
  };

  // Calculate overall metrics
  useEffect(() => {
    const totalStaffROI = staffROI.reduce((sum, staff) => sum + staff.netROI, 0);
    const totalInventoryROI = inventoryROI.reduce((sum, item) => sum + item.netROI, 0);
    const totalRevenue = staffROI.reduce((sum, staff) => sum + staff.totalBilled, 0) + 
                        inventoryROI.reduce((sum, item) => sum + item.totalSold, 0);
    const totalCosts = staffROI.reduce((sum, staff) => sum + staff.salaryAmount, 0) + 
                      inventoryROI.reduce((sum, item) => sum + item.totalCost, 0);
    const netProfit = totalStaffROI + totalInventoryROI;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    setMetrics({
      totalStaffROI,
      totalInventoryROI,
      totalRevenue,
      totalCosts,
      netProfit,
      profitMargin
    });
  }, [staffROI, inventoryROI]);

  const getROIColor = (percentage: number) => {
    if (percentage >= 50) return 'text-green-600 dark:text-green-400';
    if (percentage >= 20) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getROIBadgeVariant = (percentage: number) => {
    if (percentage >= 50) return 'default';
    if (percentage >= 20) return 'secondary';
    return 'destructive';
  };

  const filteredStaffROI = staffROI.filter(staff => {
    if (staffFilter !== 'all' && staff.staffId !== staffFilter) return false;
    if (departmentFilter !== 'all') {
      const staffData = staffList.find(s => s.id === staff.staffId);
      if (staffData?.department !== departmentFilter) return false;
    }
    return true;
  });

  const filteredInventoryROI = inventoryROI.filter(item => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ROI Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Track return on investment for staff and inventory</p>
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

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.start, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.start}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, start: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.end, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.end}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, end: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Staff Filter</Label>
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staffList.map(staff => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(metrics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From all sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Staff ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getROIColor(metrics.totalStaffROI / (staffROI.reduce((sum, s) => sum + s.salaryAmount, 0) || 1) * 100)}`}>
              {formatCurrency(metrics.totalStaffROI)}
            </div>
            <p className="text-xs text-muted-foreground">
              {((metrics.totalStaffROI / (staffROI.reduce((sum, s) => sum + s.salaryAmount, 0) || 1)) * 100).toFixed(1)}% return
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              Inventory ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getROIColor(metrics.totalInventoryROI / (inventoryROI.reduce((sum, i) => sum + i.totalCost, 0) || 1) * 100)}`}>
              {formatCurrency(metrics.totalInventoryROI)}
            </div>
            <p className="text-xs text-muted-foreground">
              {((metrics.totalInventoryROI / (inventoryROI.reduce((sum, i) => sum + i.totalCost, 0) || 1)) * 100).toFixed(1)}% return
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-600" />
              Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getROIColor(metrics.profitMargin)}`}>
              {metrics.profitMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Overall profitability</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="staff">Staff ROI ({filteredStaffROI.length})</TabsTrigger>
          <TabsTrigger value="inventory">Inventory ROI ({filteredInventoryROI.length})</TabsTrigger>
          <TabsTrigger value="services">Services ({servicesROI.length})</TabsTrigger>
          <TabsTrigger value="products">Products ({productsROI.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ROI Analysis Summary</CardTitle>
              <CardDescription>
                Period: {format(dateRange.start, 'PPP')} to {format(dateRange.end, 'PPP')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Staff Performance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total Staff Earnings:</span>
                      <span className="font-medium">{formatCurrency(staffROI.reduce((sum, s) => sum + s.totalBilled, 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total Staff Costs:</span>
                      <span className="font-medium">{formatCurrency(staffROI.reduce((sum, s) => sum + s.salaryAmount, 0))}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm font-medium">Net Staff ROI:</span>
                      <span className={`font-bold ${getROIColor(metrics.totalStaffROI / (staffROI.reduce((sum, s) => sum + s.salaryAmount, 0) || 1) * 100)}`}>
                        {formatCurrency(metrics.totalStaffROI)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Inventory Performance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total Inventory Sales:</span>
                      <span className="font-medium">{formatCurrency(inventoryROI.reduce((sum, i) => sum + i.totalSold, 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total Inventory Costs:</span>
                      <span className="font-medium">{formatCurrency(inventoryROI.reduce((sum, i) => sum + i.totalCost, 0))}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm font-medium">Net Inventory ROI:</span>
                      <span className={`font-bold ${getROIColor(metrics.totalInventoryROI / (inventoryROI.reduce((sum, i) => sum + i.totalCost, 0) || 1) * 100)}`}>
                        {formatCurrency(metrics.totalInventoryROI)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Key Insights</h4>
                <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <p>• Top performing staff member: {staffROI[0]?.staffName || 'N/A'} ({staffROI[0] ? staffROI[0].roiPercentage.toFixed(1) : '0'}% ROI)</p>
                  <p>• Most profitable inventory: {inventoryROI[0]?.itemName || 'N/A'} ({inventoryROI[0] ? inventoryROI[0].roiPercentage.toFixed(1) : '0'}% ROI)</p>
                  <p>• Overall profit margin: {metrics.profitMargin.toFixed(1)}%</p>
                  <p>• Total active staff: {staffROI.length} members</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaffROI.map((staff) => (
                <Card key={staff.staffId} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{staff.staffName}</CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{staff.staffRole}</p>
                      </div>
                      <Badge variant={getROIBadgeVariant(staff.roiPercentage)}>
                        {staff.roiPercentage >= 0 ? '+' : ''}{staff.roiPercentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Earnings</span>
                        <div className="font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(staff.totalBilled)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Salary</span>
                        <div className="font-medium text-red-600 dark:text-red-400">
                          {formatCurrency(staff.salaryAmount)}
                        </div>
                      </div>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Net ROI:</span>
                        <span className={`font-bold ${getROIColor(staff.roiPercentage)}`}>
                          {formatCurrency(staff.netROI)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>Orders: {staff.ordersCount}</span>
                      {staff.billingRate && (
                        <span>Rate: {formatCurrency(staff.billingRate)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredStaffROI.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Users className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Staff Data</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    No staff ROI data available for the selected period.
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="mb-4">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInventoryROI.map((item) => (
                <Card key={item.itemId} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{item.itemName}</CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.category}</p>
                      </div>
                      <Badge variant={getROIBadgeVariant(item.roiPercentage)}>
                        {item.roiPercentage >= 0 ? '+' : ''}{item.roiPercentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Revenue</span>
                        <div className="font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(item.totalSold)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Cost</span>
                        <div className="font-medium text-red-600 dark:text-red-400">
                          {formatCurrency(item.totalCost)}
                        </div>
                      </div>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Net ROI:</span>
                        <span className={`font-bold ${getROIColor(item.roiPercentage)}`}>
                          {formatCurrency(item.netROI)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>Units: {item.unitsSold}</span>
                      <span>Avg Price: {formatCurrency(item.avgSellingPrice)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredInventoryROI.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Package className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Inventory Data</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    No inventory ROI data available for the selected period.
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="services" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servicesROI.map((service) => (
                <Card 
                  key={service.serviceName} 
                  className="hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => {
                    setSelectedService(service);
                    setServiceBillsPage(1);
                    setServiceOrdersPage(1);
                    setShowServiceModal(true);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{service.serviceName}</CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Total Income: {formatCurrency(service.totalIncome)}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {service.timesUsed} uses
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Avg Price</span>
                        <div className="font-medium text-blue-600 dark:text-blue-400">
                          {formatCurrency(service.avgPrice)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Orders</span>
                        <div className="font-medium text-green-600 dark:text-green-400">
                          {service.relatedOrders.length}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>Bills: {service.relatedBills.length}</span>
                      <span>Click for details</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {servicesROI.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <FileText className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Services Data</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    No services data available for the selected period.
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productsROI.map((product) => (
                <Card 
                  key={product.productName} 
                  className="hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => {
                    setSelectedProduct(product);
                    setProductBillsPage(1);
                    setProductOrdersPage(1);
                    setShowProductModal(true);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{product.productName}</CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Total Income: {formatCurrency(product.totalIncome)}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {product.timesUsed} uses
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Avg Price</span>
                        <div className="font-medium text-blue-600 dark:text-blue-400">
                          {formatCurrency(product.avgPrice)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Orders</span>
                        <div className="font-medium text-green-600 dark:text-green-400">
                          {product.relatedOrders.length}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>Bills: {product.relatedBills.length}</span>
                      <span>Click for details</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {productsROI.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Package className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Products Data</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    No products data available for the selected period.
                  </p>
                </div>
              )}
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
                                    <div className="text-xs text-gray-500">
                                      {bill.date ? format(new Date(bill.date.toDate ? bill.date.toDate() : bill.date), 'MMM dd, yyyy') : 'No date'}
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
                              <div className="text-sm text-gray-600">
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
                                    <div className="text-xs text-gray-500">
                                      {order.date ? format(new Date(order.date.toDate ? order.date.toDate() : order.date), 'MMM dd, yyyy') : 'No date'}
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
                              <div className="text-sm text-gray-600">
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
                                    <div className="text-xs text-gray-500">
                                      {bill.date ? format(new Date(bill.date.toDate ? bill.date.toDate() : bill.date), 'MMM dd, yyyy') : 'No date'}
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
                              <div className="text-sm text-gray-600">
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
                                    <div className="text-xs text-gray-500">
                                      {order.date ? format(new Date(order.date.toDate ? order.date.toDate() : order.date), 'MMM dd, yyyy') : 'No date'}
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
                              <div className="text-sm text-gray-600">
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
    </div>
  );
};

export default ROIDashboard;
