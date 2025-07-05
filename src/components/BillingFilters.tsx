import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Search, X, Calendar } from 'lucide-react';

interface BillingFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterStatus: 'all' | 'paid' | 'partial' | 'unpaid';
  setFilterStatus: (value: 'all' | 'paid' | 'partial' | 'unpaid') => void;
  filterDateRange: 'all' | 'today' | 'week' | 'month';
  setFilterDateRange: (value: 'all' | 'today' | 'week' | 'month') => void;
  onDateFilter: (startDate: Date | null, endDate: Date | null) => void;
  dateFilterLoading?: boolean;
}

const BillingFilters: React.FC<BillingFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  filterDateRange,
  setFilterDateRange,
  onDateFilter,
  dateFilterLoading = false
}) => {
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const handleDateChange = (type: 'single' | 'from' | 'to', date: Date | undefined) => {
    if (type === 'single') {
      setSingleDate(date);
      if (date) {
        // For single date, set both start and end to the same date (full day)
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        onDateFilter(start, end);
      }
    } else if (type === 'from') {
      setStartDate(date);
      if (date && endDate) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        onDateFilter(start, endDate);
      }
    } else if (type === 'to') {
      setEndDate(date);
      if (startDate && date) {
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        onDateFilter(startDate, end);
      }
    }
  };

  const clearDateFilter = () => {
    setSingleDate(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
    onDateFilter(null, null);
  };

  const hasDateFilter = singleDate || startDate || endDate;

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Main Filters Row - Search, Status, and Date Filter in one row for big screens */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
          {/* Search Filter */}
          <div className="lg:col-span-1">
            <Label htmlFor="search" className="text-sm font-medium mb-2 block">
              Search Bills
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="search"
                type="text"
                placeholder="Search by bill ID, customer, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-1">
            <Label htmlFor="statusFilter" className="text-sm font-medium mb-2 block">
              Payment Status
            </Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger id="statusFilter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">✅ Paid</SelectItem>
                <SelectItem value="partial">⚠️ Partial</SelectItem>
                <SelectItem value="unpaid">❌ Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Filter - Compact Design */}
          <div className="lg:col-span-1 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                📅 Date Filter
              </Label>
              {hasDateFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearDateFilter}
                  disabled={dateFilterLoading}
                  className="text-red-600 hover:bg-red-50 h-7 px-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Pick Date */}
              <div>
                <DatePicker
                  date={singleDate}
                  onDateChange={(date) => handleDateChange('single', date)}
                  placeholder="Pick Date"
                  className="text-xs"
                />
              </div>

              {/* From Date */}
              <div>
                <DatePicker
                  date={startDate}
                  onDateChange={(date) => handleDateChange('from', date)}
                  placeholder="From Date"
                  className="text-xs"
                />
              </div>

              {/* To Date */}
              <div>
                <DatePicker
                  date={endDate}
                  onDateChange={(date) => handleDateChange('to', date)}
                  placeholder="To Date"
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BillingFilters;
