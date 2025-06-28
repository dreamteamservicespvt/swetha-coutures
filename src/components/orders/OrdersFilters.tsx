
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Search, X, Calendar } from 'lucide-react';

interface OrdersFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  dateFilter: { from?: Date; to?: Date; single?: Date };
  setDateFilter: (value: { from?: Date; to?: Date; single?: Date }) => void;
}

const OrdersFilters: React.FC<OrdersFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  dateFilter,
  setDateFilter
}) => {
  const handleDateRangeChange = (type: 'from' | 'to' | 'single', date: Date | undefined) => {
    if (type === 'single') {
      setDateFilter({ single: date });
    } else {
      setDateFilter({
        ...dateFilter,
        [type]: date,
        single: undefined
      });
    }
  };

  const clearDateFilter = () => {
    setDateFilter({});
  };

  const hasDateFilter = dateFilter.from || dateFilter.to || dateFilter.single;

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Main Filters Row - Search, Status, and Date Filter in one row for big screens */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
          {/* Search Filter */}
          <div className="lg:col-span-1">
            <Label htmlFor="search" className="text-sm font-medium mb-2 block">
              Search Orders
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="search"
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-1">
            <Label htmlFor="statusFilter" className="text-sm font-medium mb-2 block">
              Filter by Status
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="delivery-deadline">Delivery Deadline (≤5 days)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Filter - Compact Design */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Date Filter
              </Label>
              {hasDateFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearDateFilter}
                  className="text-red-600 hover:bg-red-50 h-7 px-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Single Date */}
              <div>
                <DatePicker
                  date={dateFilter.single}
                  onDateChange={(date) => handleDateRangeChange('single', date)}
                  placeholder="Pick date"
                  className="text-xs"
                />
              </div>

              {/* Date Range */}
              <div>
                <DatePicker
                  date={dateFilter.from}
                  onDateChange={(date) => handleDateRangeChange('from', date)}
                  placeholder="From date"
                  className="text-xs"
                />
              </div>

              <div>
                <DatePicker
                  date={dateFilter.to}
                  onDateChange={(date) => handleDateRangeChange('to', date)}
                  placeholder="To date"
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

export default OrdersFilters;
