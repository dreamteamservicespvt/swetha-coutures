
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, X, Search, Filter, ArrowUpDown, Users, CreditCard, CalendarDays, SortAsc, SortDesc } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface CustomerFiltersProps {
  onDateFilter: (startDate: Date | null, endDate: Date | null) => void;
  onTypeFilter: (type: string | null) => void;
  onPaymentStatusFilter: (status: string | null) => void;
  onSearch: (searchTerm: string) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  searchTerm: string;
  loading?: boolean;
}

const CustomerFilters: React.FC<CustomerFiltersProps> = ({ 
  onDateFilter, 
  onTypeFilter, 
  onPaymentStatusFilter, 
  onSearch, 
  onSortChange,
  searchTerm, 
  loading 
}) => {
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [filterMode, setFilterMode] = useState<'single' | 'range'>('single');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handleApplyFilter = () => {
    if (filterMode === 'single' && singleDate) {
      const start = new Date(singleDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(singleDate);
      end.setHours(23, 59, 59, 999);
      onDateFilter(start, end);
    } else if (filterMode === 'range' && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      onDateFilter(start, end);
    }
  };

  const handleClearFilter = () => {
    setSingleDate(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedType('');
    setSelectedPaymentStatus('');
    setSelectedSort('name');
    setSortOrder('asc');
    onDateFilter(null, null);
    onTypeFilter(null);
    onPaymentStatusFilter(null);
    onSortChange('name', 'asc');
    onSearch('');
  };

  // Check if any filters are active
  const hasActiveFilters = selectedType || selectedPaymentStatus || singleDate || startDate || endDate || searchTerm;

  // Get active filters count
  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedType) count++;
    if (selectedPaymentStatus) count++;
    if (singleDate || (startDate && endDate)) count++;
    if (searchTerm) count++;
    return count;
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    onTypeFilter(value === 'all' ? null : value);
  };

  const handlePaymentStatusChange = (value: string) => {
    setSelectedPaymentStatus(value);
    onPaymentStatusFilter(value === 'all' ? null : value);
  };

  const handleSortChange = (value: string) => {
    setSelectedSort(value);
    onSortChange(value, sortOrder);
  };

  const handleSortOrderToggle = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    onSortChange(selectedSort, newOrder);
  };

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Customer Filters
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFiltersCount()} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilter}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="lg:hidden"
            >
              <Filter className="h-4 w-4 mr-1" />
              {showAdvancedFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Bar - Always Visible */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers by name, phone, email, or city..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10 h-11 text-sm"
          />
        </div>

        {/* Quick Filters - Always Visible on Large Screens */}
        <div className={cn(
          "space-y-4",
          !showAdvancedFilters && "hidden lg:block"
        )}>
          {/* Primary Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Customer Type Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customer Type
              </Label>
              <Select value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="regular">👤 Regular</SelectItem>
                  <SelectItem value="premium">⭐ Premium</SelectItem>
                  <SelectItem value="vip">👑 VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Status Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Status
              </Label>
              <Select value={selectedPaymentStatus} onValueChange={handlePaymentStatusChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">✅ Paid</SelectItem>
                  <SelectItem value="partial">⚠️ Partial</SelectItem>
                  <SelectItem value="unpaid">❌ Unpaid</SelectItem>
                  <SelectItem value="outstanding">🔴 Outstanding</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Sort By
              </Label>
              <Select value={selectedSort} onValueChange={handleSortChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="totalSpent">Total Spent</SelectItem>
                  <SelectItem value="totalOrders">Total Orders</SelectItem>
                  <SelectItem value="recent">Recently Added</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                Order
              </Label>
              <Button
                variant="outline"
                onClick={handleSortOrderToggle}
                className="h-10 w-full justify-start"
              >
                {sortOrder === 'asc' ? (
                  <>
                    <SortAsc className="h-4 w-4 mr-2" />
                    Ascending
                  </>
                ) : (
                  <>
                    <SortDesc className="h-4 w-4 mr-2" />
                    Descending
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Date Filters Section */}
          <div className="border-t pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Date Filter
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={filterMode === 'single' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterMode('single')}
                    className="text-xs"
                  >
                    Single Date
                  </Button>
                  <Button
                    type="button"
                    variant={filterMode === 'range' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterMode('range')}
                    className="text-xs"
                  >
                    Date Range
                  </Button>
                </div>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filterMode === 'single' ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Select Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-10 w-full justify-start text-left font-normal",
                            !singleDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {singleDate ? format(singleDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={singleDate}
                          onSelect={setSingleDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">From Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-10 w-full justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "PPP") : <span>From date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">To Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-10 w-full justify-start text-left font-normal",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP") : <span>To date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                )}
                
                {/* Apply Date Filter Button */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Apply</Label>
                  <Button
                    onClick={handleApplyFilter}
                    disabled={
                      loading ||
                      (filterMode === 'single' && !singleDate) ||
                      (filterMode === 'range' && (!startDate || !endDate))
                    }
                    className="h-10 w-full"
                    size="sm"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Apply Date Filter
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerFilters;
