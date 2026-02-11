import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  RefreshCw
} from 'lucide-react';
import { collection, getDocs, query, orderBy, where, deleteDoc, doc, onSnapshot, Timestamp, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bill, formatCurrency, getBillStatusColor, calculateBillStatus, downloadPDF, printBill, formatBillDate, formatDateForDisplay } from '@/utils/billingUtils';
import { useRealTimeData } from '@/hooks/useRealTimeData';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import BillWhatsAppAdvanced from '@/components/BillWhatsAppAdvanced';
import BillingDateFilter from '@/components/BillingDateFilter';

const Billing = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilterLoading, setDateFilterLoading] = useState(false);
  const [downloadingPdfBillId, setDownloadingPdfBillId] = useState<string | null>(null);

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
        case 'week':
          const weekAgo = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = billDate >= weekAgo;
          break;
        case 'month':
          const monthAgo = new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = billDate >= monthAgo;
          break;
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
    setDownloadingPdfBillId(bill.id);
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
    } finally {
      setDownloadingPdfBillId(null);
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

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in p-4 sm:p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Billing Dashboard</h1>
          <p className="text-gray-600 text-sm sm:text-base">Manage bills, track payments, and generate professional invoices</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            size="default"
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => navigate('/billing/new')}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 w-full sm:w-auto"
            size="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate Bill
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Total Bills</CardTitle>
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-purple-900">{stats.totalBills}</div>
            <p className="text-xs text-purple-600 mt-1">All time records</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-green-900">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-green-600 mt-1">Gross income</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Paid Bills</CardTitle>
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-blue-900">{stats.paidBills}</div>
            <p className="text-xs text-blue-600 mt-1">Completed payments</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Pending Amount</CardTitle>
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-900">{formatCurrency(stats.pendingAmount)}</div>
            <p className="text-xs text-red-600 mt-1">Outstanding balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Search Bills</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by bill ID, customer, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Status</label>
              <Select value={filterStatus} onValueChange={(value: 'all' | 'paid' | 'partial' | 'unpaid') => setFilterStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">✅ Paid</SelectItem>
                  <SelectItem value="partial">⚠️ Partial</SelectItem>
                  <SelectItem value="unpaid">❌ Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Date Range</label>
              <Select value={filterDateRange} onValueChange={(value: 'all' | 'today' | 'week' | 'month') => setFilterDateRange(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Custom Date</label>
              <BillingDateFilter 
                onDateFilter={handleDateFilter}
                loading={dateFilterLoading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bills Content */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bills ({filteredBills.length})</span>
            {filteredBills.length > 0 && (
              <Badge variant="outline" className="text-gray-600 dark:text-gray-400">
                {filteredBills.length} of {bills.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredBills.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No bills found</h3>
              <p className="text-gray-500 mb-6">
                {bills.length === 0 
                  ? "Create your first professional bill to get started." 
                  : "Try adjusting your search or filter criteria."
                }
              </p>
              <Button 
                onClick={() => navigate('/billing/new')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Generate New Bill
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile Card View - Show on all screens, responsive layout */}
              <div className="block lg:hidden space-y-4">
                {filteredBills.map((bill: Bill) => {
                  const status = calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || 0);
                  return (
                    <Card 
                      key={bill.id} 
                      className="hover:shadow-lg transition-all duration-200 cursor-pointer border-gray-200 dark:border-gray-700"
                      onClick={() => navigate(`/billing/${bill.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-purple-600 text-lg">{bill.billId || 'N/A'}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {formatDateForDisplay(bill.date)}
                              </p>
                            </div>
                            <Badge className={getBillStatusColor(status)}>
                              {status === 'paid' ? '✅ Paid' : status === 'partial' ? '⚠️ Partial' : '❌ Unpaid'}
                            </Badge>
                          </div>

                          {/* Customer Info */}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{bill.customerName || 'N/A'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{bill.customerPhone || 'N/A'}</p>
                          </div>

                          {/* Amount Info */}
                          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <div className="text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(bill.totalAmount || 0)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Paid</p>
                              <p className="font-semibold text-green-600">{formatCurrency(bill.paidAmount || 0)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
                              <p className={`font-semibold ${(bill.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(bill.balance || 0)}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/billing/${bill.id}`);
                              }}
                              className="hover:bg-blue-50 hover:border-blue-300 text-xs"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleWhatsAppShare(bill, e)}
                              className="hover:bg-green-50 hover:border-green-300 text-green-600 text-xs"
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Share
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleDownloadPDF(bill, e)}
                              disabled={downloadingPdfBillId === bill.id}
                              className="hover:bg-purple-50 hover:border-purple-300 text-xs"
                            >
                              {downloadingPdfBillId === bill.id ? (
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3 mr-1" />
                              )}
                              {downloadingPdfBillId === bill.id ? 'Downloading...' : 'PDF'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table View - Hidden on mobile */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBills.map((bill: Bill) => {
                      const status = calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || 0);
                      return (
                        <TableRow 
                          key={bill.id} 
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/billing/${bill.id}`)}
                        >
                          <TableCell className="font-medium text-purple-600">{bill.billId || 'N/A'}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{bill.customerName || 'N/A'}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{bill.customerPhone || 'N/A'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {bill.date ? new Date(bill.date?.toDate?.() || bill.date).toLocaleDateString('en-IN') : 'N/A'}
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(bill.totalAmount || 0)}</TableCell>
                          <TableCell className="text-green-600">{formatCurrency(bill.paidAmount || 0)}</TableCell>
                          <TableCell className={(bill.balance || 0) > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
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
                                className="hover:bg-blue-50 hover:border-blue-300"
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
                                className="hover:bg-purple-50 hover:border-purple-300"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleDownloadPDF(bill, e)}
                                disabled={downloadingPdfBillId === bill.id}
                                className="hover:bg-green-50 hover:border-green-300"
                              >
                                {downloadingPdfBillId === bill.id ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleWhatsAppShare(bill, e)}
                                className="hover:bg-green-50 hover:border-green-300 text-green-600"
                              >
                                <MessageSquare className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleDeleteBill(bill.id, e)}
                                className="hover:bg-red-50 hover:border-red-300 text-red-600"
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
  );
};

export default Billing;
