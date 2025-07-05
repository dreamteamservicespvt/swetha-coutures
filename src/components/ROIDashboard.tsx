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
import { CalendarIcon, TrendingUp, TrendingDown, Users, Package, DollarSign, BarChart3, Download, Filter, RefreshCw } from 'lucide-react';
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
  const [selectedTab, setSelectedTab] = useState<'staff' | 'inventory' | 'overview'>('overview');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Data states
  const [staffROI, setStaffROI] = useState<StaffROI[]>([]);
  const [inventoryROI, setInventoryROI] = useState<InventoryROI[]>([]);
  const [metrics, setMetrics] = useState<ROIMetrics>({
    totalStaffROI: 0,
    totalInventoryROI: 0,
    totalRevenue: 0,
    totalCosts: 0,
    netProfit: 0,
    profitMargin: 0
  });
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

        const salaryAmount = staffMember.salaryAmount || 0;
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="staff">Staff ROI ({filteredStaffROI.length})</TabsTrigger>
          <TabsTrigger value="inventory">Inventory ROI ({filteredInventoryROI.length})</TabsTrigger>
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
      </Tabs>
    </div>
  );
};

export default ROIDashboard;
