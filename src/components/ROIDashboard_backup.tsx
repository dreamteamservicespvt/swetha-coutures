import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DatePicker } from '@/components/ui/date-picker';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Users, 
  Package, 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3,
  Target,
  Award,
  AlertCircle,
  Calendar,
  Filter,
  Calculator,
  Download
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency } from '@/utils/billingUtils';
import { useAuth } from '@/contexts/AuthContext';

interface StaffROI {
  id: string;
  name: string;
  role: string;
  department: string;
  salaryAmount: number;
  salaryMode: 'monthly' | 'daily' | 'hourly';
  totalBilled: number;
  totalROI: number;
  roiPercentage: number;
  assignedOrders: number;
  completedOrders: number;
  averageOrderValue: number;
}

interface InventoryROI {
  id: string;
  itemName: string;
  category: string;
  costPrice: number;
  totalCostInvested: number;
  totalSoldAmount: number;
  totalROI: number;
  roiPercentage: number;
  unitsSold: number;
  averageSellingPrice: number;
  turnoverRate: number;
}

interface FilterOptions {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  staffFilter: string;
  departmentFilter: string;
  categoryFilter: string;
  itemTypeFilter: 'all' | 'staff' | 'inventory';
}

const ROIDashboard = () => {
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1) // First day of current month
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [roiData, setROIData] = useState<PeriodROI | null>(null);
  const [topStaff, setTopStaff] = useState<StaffROI[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'staff' | 'inventory' | 'services'>('staff');

  const fetchROIData = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Date Range Required",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const [periodROI, topPerformers] = await Promise.all([
        calculatePeriodROI(startDate, endDate),
        getTopPerformingStaff(10, startDate, endDate)
      ]);

      setROIData(periodROI);
      setTopStaff(topPerformers);
    } catch (error) {
      console.error('Error fetching ROI data:', error);
      toast({
        title: "Error",
        description: "Failed to load ROI data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchROIData();
  }, [startDate, endDate]);

  const getROIColor = (percentage: number) => {
    if (percentage >= 50) return 'text-green-600';
    if (percentage >= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getROIBadgeVariant = (percentage: number) => {
    if (percentage >= 50) return 'default';
    if (percentage >= 20) return 'secondary';
    return 'destructive';
  };

  const renderStaffROI = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roiData?.staffROI.map((staff, index) => (
          <Card key={staff.staffId} className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">{staff.staffName}</CardTitle>
                </div>
                <Badge variant={getROIBadgeVariant(staff.roiPercentage)}>
                  {index + 1}
                </Badge>
              </div>
              <CardDescription>{staff.staffRole}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Income</span>
                  <div className="font-semibold text-green-600">
                    {formatCurrency(staff.totalIncome)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cost</span>
                  <div className="font-semibold text-red-600">
                    {formatCurrency(staff.totalCost)}
                  </div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>ROI</span>
                  <span className={`font-semibold ${getROIColor(staff.roiPercentage)}`}>
                    {staff.roiPercentage.toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(staff.roiPercentage, 100)} className="h-2" />
              </div>
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Services: {staff.itemCount}</span>
                <span>Profit: {formatCurrency(staff.netProfit)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {roiData?.staffROI.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No staff ROI data available for the selected period</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderInventoryROI = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roiData?.inventoryROI.map((inventory, index) => (
          <Card key={inventory.inventoryId} className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">{inventory.itemName}</CardTitle>
                </div>
                <Badge variant={getROIBadgeVariant(inventory.roiPercentage)}>
                  {index + 1}
                </Badge>
              </div>
              <CardDescription>{inventory.category}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Sales</span>
                  <div className="font-semibold text-green-600">
                    {formatCurrency(inventory.totalIncome)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cost</span>
                  <div className="font-semibold text-red-600">
                    {formatCurrency(inventory.totalCost)}
                  </div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>ROI</span>
                  <span className={`font-semibold ${getROIColor(inventory.roiPercentage)}`}>
                    {inventory.roiPercentage.toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(inventory.roiPercentage, 100)} className="h-2" />
              </div>
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Units: {inventory.unitsSold}</span>
                <span>Avg Price: {formatCurrency(inventory.avgSellingPrice)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {roiData?.inventoryROI.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No inventory ROI data available for the selected period</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderServicesROI = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roiData?.serviceROI.map((service, index) => (
          <Card key={service.serviceId} className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-lg">{service.serviceName}</CardTitle>
                </div>
                <Badge variant={getROIBadgeVariant(service.roiPercentage)}>
                  {index + 1}
                </Badge>
              </div>
              <CardDescription>{service.category}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Revenue</span>
                  <div className="font-semibold text-green-600">
                    {formatCurrency(service.totalIncome)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cost</span>
                  <div className="font-semibold text-red-600">
                    {formatCurrency(service.totalCost)}
                  </div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>ROI</span>
                  <span className={`font-semibold ${getROIColor(service.roiPercentage)}`}>
                    {service.roiPercentage.toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(service.roiPercentage, 100)} className="h-2" />
              </div>
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Times: {service.timesProvided}</span>
                <span>Avg Rate: {formatCurrency(service.avgRate)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {roiData?.serviceROI.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="text-center py-8">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No service ROI data available for the selected period</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">ROI Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">Track return on investment for staff, inventory, and services</p>
        </div>
        <Button onClick={fetchROIData} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <DatePicker
                date={startDate}
                onDateChange={setStartDate}
                placeholder="Select start date"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <DatePicker
                date={endDate}
                onDateChange={setEndDate}
                placeholder="Select end date"
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {roiData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Income</CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(roiData.totalIncome)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cost</CardTitle>
              <TrendingDown className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(roiData.totalCost)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Profit</CardTitle>
              <DollarSign className={`h-5 w-5 ${roiData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${roiData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(roiData.netProfit)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall ROI</CardTitle>
              <Target className={`h-5 w-5 ${getROIColor(roiData.roiPercentage)}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getROIColor(roiData.roiPercentage)}`}>
                {roiData.roiPercentage.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ROI Analysis Tabs */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            ROI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="staff" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Staff ({roiData?.staffROI.length || 0})
              </TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Inventory ({roiData?.inventoryROI.length || 0})
              </TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Services ({roiData?.serviceROI.length || 0})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="staff" className="mt-6">
              {renderStaffROI()}
            </TabsContent>
            
            <TabsContent value="inventory" className="mt-6">
              {renderInventoryROI()}
            </TabsContent>
            
            <TabsContent value="services" className="mt-6">
              {renderServicesROI()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Top Performers */}
      {topStaff.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-600" />
              Top Performing Staff
            </CardTitle>
            <CardDescription>
              Staff members with the highest ROI in the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topStaff.slice(0, 5).map((staff, index) => (
                <div key={staff.staffId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold">{staff.staffName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{staff.staffRole}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${getROIColor(staff.roiPercentage)}`}>
                      {staff.roiPercentage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(staff.netProfit)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ROIDashboard;
