
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, X, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CustomerFiltersProps {
  onDateFilter: (startDate: Date | null, endDate: Date | null) => void;
  onTypeFilter: (type: string | null) => void;
  onPaymentStatusFilter: (status: string | null) => void;
  onSearch: (searchTerm: string) => void;
  searchTerm: string;
  loading?: boolean;
}

const CustomerFilters: React.FC<CustomerFiltersProps> = ({ 
  onDateFilter, 
  onTypeFilter, 
  onPaymentStatusFilter, 
  onSearch, 
  searchTerm, 
  loading 
}) => {
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [filterMode, setFilterMode] = useState<'single' | 'range'>('single');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('');

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
    onDateFilter(null, null);
    onTypeFilter(null);
    onPaymentStatusFilter(null);
    onSearch('');
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    onTypeFilter(value === 'all' ? null : value);
  };

  const handlePaymentStatusChange = (value: string) => {
    setSelectedPaymentStatus(value);
    onPaymentStatusFilter(value === 'all' ? null : value);
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Search Bar - First Row */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers by name, phone, email, or city..."
              value={searchTerm}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Second Row - All Other Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 items-end">
            {/* Customer Type Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Customer Type</Label>
              <Select value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Status Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Status</Label>
              <Select value={selectedPaymentStatus} onValueChange={handlePaymentStatusChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="outstanding">Outstanding</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter Mode Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date Filter</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={filterMode === 'single' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterMode('single')}
                  className="flex-1 h-10 text-xs"
                >
                  Pick Date
                </Button>
                <Button
                  type="button"
                  variant={filterMode === 'range' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterMode('range')}
                  className="flex-1 h-10 text-xs"
                >
                  Range
                </Button>
              </div>
            </div>

            {/* Date Pickers */}
            {filterMode === 'single' ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Date</Label>
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
                  <Label className="text-sm font-medium">From Date</Label>
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
                  <Label className="text-sm font-medium">To Date</Label>
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
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 lg:col-span-2 xl:col-span-1">
              <Button
                onClick={handleApplyFilter}
                disabled={
                  loading ||
                  (filterMode === 'single' && !singleDate) ||
                  (filterMode === 'range' && (!startDate || !endDate))
                }
                className="flex-1 h-10"
                size="sm"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Apply
              </Button>
              <Button
                variant="outline"
                onClick={handleClearFilter}
                disabled={loading}
                size="sm"
                className="flex-1 h-10"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerFilters;
