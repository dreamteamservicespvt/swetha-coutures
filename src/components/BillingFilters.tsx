import React from 'react';
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
  // Controlled custom-date filter (state lives in the parent so it persists across navigation)
  singleDate?: Date;
  startDate?: Date;
  endDate?: Date;
  onDateChange: (type: 'single' | 'from' | 'to', date: Date | undefined) => void;
  onClearDates: () => void;
}

const BillingFilters: React.FC<BillingFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  singleDate,
  startDate,
  endDate,
  onDateChange,
  onClearDates,
}) => {
  const hasDateFilter = !!(singleDate || startDate || endDate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
      {/* Search Filter (medium width) */}
      <div className="lg:col-span-3">
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

      {/* Status Filter (narrow — only 4 short options) */}
      <div className="lg:col-span-3">
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

      {/* Custom Date Filter (widest — holds three calendars) */}
      <div className="lg:col-span-6 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            📅 Custom Date Filter
          </Label>
          {hasDateFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearDates}
              className="text-red-600 hover:bg-red-50 h-7 px-2"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Pick Date */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Pick Date</span>
            <DatePicker
              date={singleDate}
              onDateChange={(date) => onDateChange('single', date)}
              placeholder="Pick a date"
              className="w-full"
            />
          </div>

          {/* From Date */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">From Date</span>
            <DatePicker
              date={startDate}
              onDateChange={(date) => onDateChange('from', date)}
              placeholder="From date"
              className="w-full"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">To Date</span>
            <DatePicker
              date={endDate}
              onDateChange={(date) => onDateChange('to', date)}
              placeholder="To date"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingFilters;
