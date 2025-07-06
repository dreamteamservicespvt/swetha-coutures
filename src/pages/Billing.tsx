import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Trash2, 
  Download, 
  MessageSquare, 
  Filter,
  Grid3X3,
  List,
  Calendar,
  TrendingUp,
  DollarSign,
  FileText,
  Users,
  RefreshCw,
  Printer,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { collection, getDocs, query, orderBy, where, deleteDoc, doc, onSnapshot, Timestamp, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bill, formatCurrency, getBillStatusColor, calculateBillStatus, downloadPDF, printBill } from '@/utils/billingUtils';
import { useRealTimeData } from '@/hooks/useRealTimeData';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import BillWhatsAppAdvanced from '@/components/BillWhatsAppAdvanced';
import BillingFilters from '@/components/BillingFilters';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Billing = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilterLoading, setDateFilterLoading] = useState(false);
  
  // Mobile date filter states
  const [mobileSingleDate, setMobileSingleDate] = useState<Date | undefined>();
  const [mobileStartDate, setMobileStartDate] = useState<Date | undefined>();
  const [mobileEndDate, setMobileEndDate] = useState<Date | undefined>();

  // Calculate stats
  const stats = {
    totalBills: bills.length,
    totalRevenue: bills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0),
    paidBills: bills.filter(bill => calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || 0) === 'paid').length,
    pendingAmount: bills.reduce((sum, bill) => sum + (bill.balance || 0), 0)
  };

  // Fetch bills with real-time updates
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'bills'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        try {
          const billsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Bill[];
          setBills(billsData);
          setLoading(false);
        } catch (error) {
          console.error('Error processing bills data:', error);
          toast({
            title: "Data Processing Error",
            description: "Some bill data may not display correctly. Please refresh the page.",
            variant: "destructive"
          });
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error fetching bills:', error);
        toast({
          title: "Connection Error",
          description: "Failed to fetch bills. Please check your connection and try again.",
          variant: "destructive"
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle date filter
  const handleDateFilter = async (startDate: Date | null, endDate: Date | null) => {
    setDateFilterLoading(true);
    
    try {
      let q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'));
      
      if (startDate && endDate) {
        q = query(
          collection(db, 'bills'),
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          where('createdAt', '<=', Timestamp.fromDate(endDate)),
          orderBy('createdAt', 'desc')
        );
      }
      
      const snapshot = await getDocs(q);
      const filteredBills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bill[];
      
      setBills(filteredBills);
      
      toast({
        title: "Filter Applied",
        description: `Found ${filteredBills.length} bills${startDate && endDate ? ' in selected date range' : ''}`,
      });
    } catch (error) {
      console.error('Error filtering bills:', error);
      toast({
        title: "Error",
        description: "Failed to apply date filter",
        variant: "destructive",
      });
    } finally {
      setDateFilterLoading(false);
    }
  };

  // Handle mobile date filter changes
  const handleMobileDateChange = (type: 'single' | 'from' | 'to', date: Date | undefined) => {
    if (type === 'single') {
      setMobileSingleDate(date);
      setMobileStartDate(undefined);
      setMobileEndDate(undefined);
      if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        handleDateFilter(start, end);
      }
    } else if (type === 'from') {
      setMobileStartDate(date);
      setMobileSingleDate(undefined);
      if (date && mobileEndDate) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(mobileEndDate);
        end.setHours(23, 59, 59, 999);
        handleDateFilter(start, end);
      }
    } else if (type === 'to') {
      setMobileEndDate(date);
      setMobileSingleDate(undefined);
      if (mobileStartDate && date) {
        const start = new Date(mobileStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        handleDateFilter(start, end);
      }
    }
  };

  // Clear mobile date filters
  const clearMobileDateFilters = () => {
    setMobileSingleDate(undefined);
    setMobileStartDate(undefined);
    setMobileEndDate(undefined);
    handleDateFilter(null, null);
  };

  const filteredBills = bills.filter((bill: Bill) => {
    const matchesSearch = 
      bill.billId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.customerPhone?.includes(searchTerm);
    
    const matchesStatus = 
      filterStatus === 'all' ||
      calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || 0) === filterStatus;
    
    let matchesDate = true;
    if (filterDateRange !== 'all') {
      const billDate = new Date(bill.date?.toDate?.() || bill.date);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (filterDateRange) {
        case 'today':
          matchesDate = billDate >= startOfDay;
          break;
        case 'week': {
          const weekAgo = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = billDate >= weekAgo;
          break;
        }
        case 'month': {
          const monthAgo = new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = billDate >= monthAgo;
          break;
        }
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleDeleteBill = async (billId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const billToDelete = bills.find(bill => bill.id === billId);
    const billNumber = billToDelete?.billId || billId;
    
    if (window.confirm(`Are you sure you want to delete bill ${billNumber}? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'bills', billId));
        toast({
          title: "Success",
          description: `Bill ${billNumber} deleted successfully`,
        });
      } catch (error) {
        console.error('Error deleting bill:', error);
        toast({
          title: "Error",
          description: `Failed to delete bill ${billNumber}`,
          variant: "destructive",
        });
      }
    }
  };

  const handleDownloadPDF = async (bill: Bill, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await downloadPDF(bill);
      toast({
        title: "PDF Downloaded",
        description: `Bill ${bill.billId} downloaded successfully`,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  const handleWhatsAppShare = (bill: Bill, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedBill(bill);
    setShowWhatsAppModal(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'bills'), orderBy('createdAt', 'desc')));
      const billsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bill[];
      setBills(billsData);
      toast({
        title: "Data Refreshed",
        description: "Bills list has been updated",
      });
    } catch (error) {
      console.error('Error refreshing bills:', error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh bills data",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handlePrintBill = async (bill: Bill, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await printBill(bill);
      toast({
        title: "Print Ready",
        description: `Bill ${bill.billId} is ready for printing`,
      });
    } catch (error) {
      console.error('Error printing bill:', error);
      toast({
        title: "Print Failed",
        description: "Failed to prepare bill for printing",
        variant: "destructive",
      });
    }
  };

  const handleExportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredBills.map(bill => {
        const status = calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || 0);
        const workItemsSummary = bill.items?.map(item => item.description).join(', ') || 'N/A';
        
        return {
          'Bill ID': bill.billId || 'N/A',
          'Customer Name': bill.customerName || 'N/A',
          'Phone': bill.customerPhone || 'N/A',
          'Bill Date': bill.date ? new Date(bill.date?.toDate?.() || bill.date).toLocaleDateString('en-IN') : 'N/A',
          'Total Amount': bill.totalAmount || 0,
          'Paid Amount': bill.paidAmount || 0,
          'Balance': bill.balance || 0,
          'Payment Status': status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid',
          'Work Items Summary': workItemsSummary
        };
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      
      // Set column widths for better readability
      const colWidths = [
        { wch: 12 }, // Bill ID
        { wch: 20 }, // Customer Name
        { wch: 15 }, // Phone
        { wch: 12 }, // Bill Date
        { wch: 12 }, // Total Amount
        { wch: 12 }, // Paid Amount
        { wch: 12 }, // Balance
        { wch: 15 }, // Payment Status
        { wch: 30 }  // Work Items Summary
      ];
      worksheet['!cols'] = colWidths;

      // Style the header row
      const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:I1');
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (worksheet[cellRef]) {
          worksheet[cellRef].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: 'E5E7EB' } },
            alignment: { horizontal: 'center' }
          };
        }
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bills');

      // Generate filename with current date
      const currentDate = new Date();
      const dateString = currentDate.toLocaleDateString('en-IN').replace(/\//g, '-');
      const filename = `bills_${dateString}.xlsx`;

      // Export file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(data, filename);

      toast({
        title: "Export Successful",
        description: `${filteredBills.length} bills exported to ${filename}`,
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export bills to Excel",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in p-4 sm:p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page-layout">
      <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
        {/* Header - Enhanced Mobile */}
        <div className="mobile-page-header">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-dark-fix mb-1 sm:mb-2">Billing Dashboard</h1>
            <p className="text-muted-dark-fix responsive-text-base">Manage bills, track payments, and generate professional invoices</p>
          </div>
        <div className="responsive-actions">
          <Button 
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-responsive bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
          >
            <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => navigate('/billing/new')}
            className="btn-responsive bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 dark:from-purple-500 dark:to-blue-500 dark:hover:from-purple-600 dark:hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            Generate Bill
          </Button>
        </div>
      </div>

      {/* Stats Cards - Enhanced Mobile Grid */}
      <div className="stats-grid-responsive">
        <Card className="card-dark-fix border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="responsive-text-sm font-medium text-purple-800 dark:text-purple-200">Total Bills</CardTitle>
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.totalBills}</div>
            <p className="responsive-text-xs text-purple-600 dark:text-purple-300">All time records</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="responsive-text-sm font-medium text-green-800 dark:text-green-200">Total Revenue</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-900 dark:text-green-100">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-green-600 dark:text-green-300">Gross income</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="responsive-text-sm font-medium text-blue-800 dark:text-blue-200">Paid Bills</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.paidBills}</div>
            <p className="text-xs text-blue-600 dark:text-blue-300">Completed payments</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="responsive-text-sm font-medium text-red-800 dark:text-red-200">Pending Amount</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-900 dark:text-red-100">{formatCurrency(stats.pendingAmount)}</div>
            <p className="text-xs text-red-600 dark:text-red-300">Outstanding balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters - Compact Layout Matching Orders Page */}
      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center justify-between text-base sm:text-lg text-gray-900 dark:text-gray-100">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
              Filters & Search
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportToExcel}
              disabled={filteredBills.length === 0}
              className="btn-responsive bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/30"
            >
              <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Export to Excel
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 sm:pb-6">
          <div className="hidden lg:block">
            {/* Desktop version - compact filters */}
            <BillingFilters
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterDateRange={filterDateRange}
              setFilterDateRange={setFilterDateRange}
              onDateFilter={handleDateFilter}
              dateFilterLoading={dateFilterLoading}
            />
          </div>
          
          {/* Mobile version - preserve the original stacked layout for better mobile experience */}
          <div className="lg:hidden space-y-4 sm:space-y-6">
            {/* Main Filters Row */}
            <div className="form-grid-responsive-3">
              {/* Search */}
              <div className="space-y-2">
                <label className="responsive-text-sm font-medium text-gray-900 dark:text-gray-100">Search Bills</label>
                <div className="relative">
                  <Search className="absolute left-2 sm:left-3 top-2 sm:top-3 h-3 w-3 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
                  <Input
                    placeholder="Search by bill ID, customer, phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 sm:pl-10 responsive-text-sm h-8 sm:h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  />
                </div>
              </div>
  
              {/* Status Filter */}
              <div className="space-y-2">
                <label className="responsive-text-sm font-medium text-gray-900 dark:text-gray-100">Payment Status</label>
                <Select value={filterStatus} onValueChange={(value: 'all' | 'paid' | 'partial' | 'unpaid') => setFilterStatus(value)}>
                  <SelectTrigger className="h-8 sm:h-10 responsive-text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="all" className="text-gray-900 dark:text-gray-100">All Status</SelectItem>
                    <SelectItem value="paid" className="text-gray-900 dark:text-gray-100">✅ Paid</SelectItem>
                    <SelectItem value="partial" className="text-gray-900 dark:text-gray-100">⚠️ Partial</SelectItem>
                    <SelectItem value="unpaid" className="text-gray-900 dark:text-gray-100">❌ Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
  
              {/* Date Range Filter */}
              <div className="space-y-2">
                <label className="responsive-text-sm font-medium text-gray-900 dark:text-gray-100">Date Range</label>
                <Select value={filterDateRange} onValueChange={(value: 'all' | 'today' | 'week' | 'month') => setFilterDateRange(value)}>
                  <SelectTrigger className="h-8 sm:h-10 responsive-text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="all" className="text-gray-900 dark:text-gray-100">All Time</SelectItem>
                    <SelectItem value="today" className="text-gray-900 dark:text-gray-100">Today</SelectItem>
                    <SelectItem value="week" className="text-gray-900 dark:text-gray-100">This Week</SelectItem>
                    <SelectItem value="month" className="text-gray-900 dark:text-gray-100">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
  
            {/* Date Filter Row - Clean and Compact */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="responsive-text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  📅 Date Filter
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearMobileDateFilters}
                  disabled={dateFilterLoading}
                  className="text-red-600 hover:bg-red-50 h-7 px-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {/* Pick Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">🗓️ Pick Date</label>
                    <DatePicker
                      date={mobileSingleDate}
                      onDateChange={(date) => handleMobileDateChange('single', date)}
                      placeholder="Pick"
                      className="text-xs h-8"
                    />
                  </div>
                  
                  {/* From Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">📆 From Date</label>
                    <DatePicker
                      date={mobileStartDate}
                      onDateChange={(date) => handleMobileDateChange('from', date)}
                      placeholder="From"
                      className="text-xs h-8"
                    />
                  </div>
                  
                  {/* To Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">📆 To Date</label>
                    <DatePicker
                      date={mobileEndDate}
                      onDateChange={(date) => handleMobileDateChange('to', date)}
                      placeholder="To"
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bills Content - Enhanced Mobile */}
      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base sm:text-lg text-gray-900 dark:text-gray-100">Bills ({filteredBills.length})</span>
              {filteredBills.length > 0 && (
                <Badge variant="outline" className="text-xs text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                  {filteredBills.length} of {bills.length}
                </Badge>
              )}
            </div>
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="rounded-r-none responsive-text-sm"
                title="Table View"
              >
                <List className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-l-none responsive-text-sm"
                title="Grid View"
              >
                <Grid3X3 className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredBills.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 dark:text-gray-500 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No bills found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 text-sm sm:text-base">
                {bills.length === 0 
                  ? "Create your first professional bill to get started." 
                  : "Try adjusting your search or filter criteria."
                }
              </p>
              <Button 
                onClick={() => navigate('/billing/new')}
                className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 responsive-text-sm"
                size="sm"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                Generate New Bill
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <>
              {/* Grid View - Enhanced to Match Orders Page */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredBills.map((bill: Bill) => {
                  const status = calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || 0);
                  return (
                    <Card 
                      key={bill.id} 
                      className="hover:shadow-lg transition-all duration-200 border border-gray-200 rounded-xl shadow-sm hover:shadow-xl"
                      onClick={() => navigate(`/billing/${bill.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          {/* Header */}
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-lg">#{bill.billId?.slice(-4) || 'N/A'}</span>
                                <Badge className={`${getBillStatusColor(status)} font-medium`} variant="outline">
                                  {status === 'paid' ? '✅ Paid' : status === 'partial' ? '⚠️ Partial' : '❌ Unpaid'}
                                </Badge>
                              </div>
                              <div className="text-xl font-semibold text-gray-900 truncate">{bill.customerName || 'N/A'}</div>
                            </div>
                            <div className="text-right text-sm text-gray-500 ml-2 flex-shrink-0">
                              <div className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                <span className="text-xs">
                                  {bill.date ? new Date(bill.date?.toDate?.() || bill.date).toLocaleDateString('en-IN') : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center text-sm text-gray-600">
                              <span className="truncate flex-1">{bill.customerPhone || 'N/A'}</span>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Total Amount:</span>
                              <span className="font-medium text-xs">{formatCurrency(bill.totalAmount || 0)}</span>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Balance:</span>
                              <span className={`font-medium text-xs ${(bill.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(bill.balance || 0)}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons - Following Orders Page Pattern */}
                          <div className="pt-3 border-t border-gray-100">
                            {/* First Actions Row - 2 buttons */}
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/billing/${bill.id}`);
                                }}
                                className="text-xs flex items-center justify-center hover:bg-blue-50 hover:border-blue-200 transition-colors h-9 font-medium"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                View
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/billing/${bill.id}/edit`);
                                }}
                                className="text-xs flex items-center justify-center hover:bg-green-50 hover:border-green-200 transition-colors h-9 font-medium"
                              >
                                <Edit className="h-3.5 w-3.5 mr-1.5" />
                                Edit
                              </Button>
                            </div>

                            {/* Second Actions Row - 2 buttons */}
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handlePrintBill(bill, e)}
                                className="hover:bg-gray-50 hover:border-gray-200 text-xs flex items-center justify-center transition-colors h-9 font-medium"
                              >
                                <Printer className="h-3.5 w-3.5 mr-1.5" />
                                Print
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleDownloadPDF(bill, e)}
                                className="hover:bg-purple-50 hover:border-purple-200 text-xs flex items-center justify-center transition-colors h-9 font-medium"
                              >
                                <Download className="h-3.5 w-3.5 mr-1.5" />
                                Download
                              </Button>
                            </div>

                            {/* Third Actions Row - 2 buttons */}
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleWhatsAppShare(bill, e)}
                                className="text-green-600 hover:bg-green-50 hover:border-green-200 text-xs flex items-center justify-center transition-colors h-9 font-medium"
                              >
                                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                WhatsApp
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleDeleteBill(bill.id, e)}
                                className="text-red-600 hover:bg-red-50 hover:border-red-200 text-xs flex items-center justify-center transition-colors h-9 font-medium"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Mobile Card View for Table Mode on Small Screens */}
              <div className="block lg:hidden space-y-4">
                {filteredBills.map((bill: Bill) => {
                  const status = calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || 0);
                  return (
                    <Card 
                      key={bill.id} 
                      className="hover:shadow-lg transition-all duration-200 cursor-pointer border-gray-200"
                      onClick={() => navigate(`/billing/${bill.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-purple-600 text-base sm:text-lg truncate">{bill.billId || 'N/A'}</h3>
                              <p className="text-xs sm:text-sm text-gray-500 truncate">
                                {bill.date ? new Date(bill.date?.toDate?.() || bill.date).toLocaleDateString('en-IN') : 'N/A'}
                              </p>
                            </div>
                            <Badge className={`${getBillStatusColor(status)} text-xs flex-shrink-0`}>
                              {status === 'paid' ? '✅ Paid' : status === 'partial' ? '⚠️ Partial' : '❌ Unpaid'}
                            </Badge>
                          </div>

                          {/* Customer Info */}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{bill.customerName || 'N/A'}</p>
                            <p className="text-xs sm:text-sm text-gray-500 truncate">{bill.customerPhone || 'N/A'}</p>
                          </div>

                          {/* Amount Info */}
                          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2 border-t border-gray-100">
                            <div className="text-center min-w-0">
                              <p className="text-xs text-gray-500 truncate">Total</p>
                              <p className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{formatCurrency(bill.totalAmount || 0)}</p>
                            </div>
                            <div className="text-center min-w-0">
                              <p className="text-xs text-gray-500 truncate">Paid</p>
                              <p className="font-semibold text-green-600 text-xs sm:text-sm truncate">{formatCurrency(bill.paidAmount || 0)}</p>
                            </div>
                            <div className="text-center min-w-0">
                              <p className="text-xs text-gray-500 truncate">Balance</p>
                              <p className={`font-semibold text-xs sm:text-sm truncate ${(bill.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(bill.balance || 0)}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/billing/${bill.id}`);
                              }}
                              className="hover:bg-blue-50 hover:border-blue-300 text-xs px-2 py-1 h-8"
                            >
                              <Eye className="h-3 w-3 sm:mr-1" />
                              <span className="hidden sm:inline">View</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleWhatsAppShare(bill, e)}
                              className="hover:bg-green-50 hover:border-green-300 text-green-600 text-xs px-2 py-1 h-8"
                            >
                              <MessageSquare className="h-3 w-3 sm:mr-1" />
                              <span className="hidden sm:inline">Share</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleDownloadPDF(bill, e)}
                              className="hover:bg-purple-50 hover:border-purple-300 text-xs px-2 py-1 h-8"
                            >
                              <Download className="h-3 w-3 sm:mr-1" />
                              <span className="hidden sm:inline">PDF</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handlePrintBill(bill, e)}
                              className="hover:bg-gray-50 hover:border-gray-300 text-xs px-2 py-1 h-8"
                            >
                              <Printer className="h-3 w-3 sm:mr-1" />
                              <span className="hidden sm:inline">Print</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Tablet Horizontal Scroll View */}
              <div className="hidden md:block lg:hidden">
                <div className="table-horizontal-scroll">
                  <Table className="table-dark-fix">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-dark-fix">Bill ID</TableHead>
                        <TableHead className="text-dark-fix">Customer</TableHead>
                        <TableHead className="text-dark-fix">Date</TableHead>
                        <TableHead className="text-dark-fix">Total</TableHead>
                        <TableHead className="text-dark-fix">Status</TableHead>
                        <TableHead className="text-dark-fix">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBills.map((bill: Bill) => {
                        const status = calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || 0);
                        return (
                          <TableRow 
                            key={bill.id} 
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                            onClick={() => navigate(`/billing/${bill.id}`)}
                          >
                            <TableCell className="font-medium text-purple-600 dark:text-purple-400">{bill.billId || 'N/A'}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium text-dark-fix">{bill.customerName || 'N/A'}</div>
                                <div className="text-sm text-muted-dark-fix">{bill.customerPhone || 'N/A'}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-dark-fix">
                              {bill.date ? new Date(bill.date?.toDate?.() || bill.date).toLocaleDateString('en-IN') : 'N/A'}
                            </TableCell>
                            <TableCell className="font-medium text-dark-fix">{formatCurrency(bill.totalAmount || 0)}</TableCell>
                            <TableCell>
                              <Badge className={getBillStatusColor(status)}>
                                {status === 'paid' ? '✅ Paid' : status === 'partial' ? '⚠️ Partial' : '❌ Unpaid'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/billing/${bill.id}`);
                                  }}
                                  className="button-dark-fix"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => handleWhatsAppShare(bill, e)}
                                  className="button-dark-fix text-green-600 dark:text-green-400"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="table-scroll-hint">
                    
                  </div>
                </div>
              </div>

              {/* Desktop Table View - Hidden on mobile */}
              <div className="hidden lg:block">
                <div className="table-horizontal-scroll">
                  <Table className="table-dark-fix">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-dark-fix">Bill ID</TableHead>
                        <TableHead className="text-dark-fix">Customer</TableHead>
                        <TableHead className="text-dark-fix">Date</TableHead>
                        <TableHead className="text-dark-fix">Total</TableHead>
                        <TableHead className="text-dark-fix">Paid</TableHead>
                        <TableHead className="text-dark-fix">Balance</TableHead>
                        <TableHead className="text-dark-fix">Status</TableHead>
                        <TableHead className="text-dark-fix">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBills.map((bill: Bill) => {
                        const status = calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || 0);
                        return (
                          <TableRow 
                            key={bill.id} 
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                            onClick={() => navigate(`/billing/${bill.id}`)}
                          >
                            <TableCell className="font-medium text-purple-600 dark:text-purple-400 table-cell-responsive">{bill.billId || 'N/A'}</TableCell>
                            <TableCell className="table-cell-responsive">
                              <div>
                                <div className="font-medium text-dark-fix">{bill.customerName || 'N/A'}</div>
                                <div className="text-sm text-muted-dark-fix">{bill.customerPhone || 'N/A'}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-dark-fix table-cell-responsive">
                              {bill.date ? new Date(bill.date?.toDate?.() || bill.date).toLocaleDateString('en-IN') : 'N/A'}
                            </TableCell>
                            <TableCell className="font-medium text-dark-fix">{formatCurrency(bill.totalAmount || 0)}</TableCell>
                            <TableCell className="text-green-600 dark:text-green-400">{formatCurrency(bill.paidAmount || 0)}</TableCell>
                            <TableCell className={(bill.balance || 0) > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-green-600 dark:text-green-400'}>
                              {formatCurrency(bill.balance || 0)}
                            </TableCell>
                            <TableCell>
                              <Badge className={getBillStatusColor(status)}>
                                {status === 'paid' ? '✅ Paid' : status === 'partial' ? '⚠️ Partial' : '❌ Unpaid'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/billing/${bill.id}`);
                                  }}
                                  className="button-dark-fix hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20 dark:hover:border-blue-700"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/billing/${bill.id}/edit`);
                                  }}
                                  className="button-dark-fix hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-900/20 dark:hover:border-purple-700"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => handleDownloadPDF(bill, e)}
                                  className="button-dark-fix hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-900/20 dark:hover:border-green-700"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => handlePrintBill(bill, e)}
                                  className="button-dark-fix hover:bg-gray-50 hover:border-gray-300 dark:hover:bg-gray-700/20 dark:hover:border-gray-600"
                                >
                                  <Printer className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => handleWhatsAppShare(bill, e)}
                                  className="button-dark-fix hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-900/20 dark:hover:border-green-700 text-green-600 dark:text-green-400"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => handleDeleteBill(bill.id, e)}
                                  className="button-dark-fix hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-900/20 dark:hover:border-red-700 text-red-600 dark:text-red-400"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="table-scroll-hint">
                    
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Advanced WhatsApp Modal */}
      {showWhatsAppModal && selectedBill && (
        <BillWhatsAppAdvanced
          isOpen={showWhatsAppModal}
          onClose={() => {
            setShowWhatsAppModal(false);
            setSelectedBill(null);
          }}
          customerName={selectedBill.customerName || ''}
          customerPhone={selectedBill.customerPhone || ''}
          billId={selectedBill.billId || ''}
          totalAmount={selectedBill.totalAmount || 0}
          balance={selectedBill.balance || 0}
          upiLink={selectedBill.upiLink || ''}
        />
      )}
      </div>
    </div>
  );
};

export default Billing;
