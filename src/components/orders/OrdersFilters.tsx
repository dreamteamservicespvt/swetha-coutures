
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import FilterPanel from '@/components/FilterPanel';

interface OrdersFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  dateFilter: { from?: Date; to?: Date; single?: Date };
  setDateFilter: (value: { from?: Date; to?: Date; single?: Date }) => void;
}

const STATUS_LABELS: Record<string, string> = {
  all: 'All statuses',
  received: 'Received',
  'in-progress': 'In Progress',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  'delivery-deadline': 'Delivery deadline (≤5 days)',
};

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

  const hasDateFilter = !!(dateFilter.from || dateFilter.to || dateFilter.single);
  const activeCount = (statusFilter !== 'all' ? 1 : 0) + (hasDateFilter ? 1 : 0);

  const summaryParts: string[] = [];
  if (statusFilter !== 'all') summaryParts.push(STATUS_LABELS[statusFilter] || statusFilter);
  if (dateFilter.single) summaryParts.push(dateFilter.single.toLocaleDateString('en-IN'));
  else if (dateFilter.from || dateFilter.to) {
    summaryParts.push(
      `${dateFilter.from?.toLocaleDateString('en-IN') || 'start'} – ${dateFilter.to?.toLocaleDateString('en-IN') || 'now'}`
    );
  }

  return (
    <FilterPanel
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Search orders by number, customer or item…"
      activeCount={activeCount}
      summary={summaryParts.length > 0 ? `Showing: ${summaryParts.join(' · ')}` : undefined}
      onClearAll={() => {
        setStatusFilter('all');
        setDateFilter({});
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="mb-1.5 block text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs">On date</Label>
          <DatePicker
            date={dateFilter.single}
            onDateChange={(date) => handleDateRangeChange('single', date)}
            placeholder="Pick date"
            className="w-full"
          />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs">From</Label>
          <DatePicker
            date={dateFilter.from}
            onDateChange={(date) => handleDateRangeChange('from', date)}
            placeholder="From date"
            className="w-full"
          />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs">To</Label>
          <DatePicker
            date={dateFilter.to}
            onDateChange={(date) => handleDateRangeChange('to', date)}
            placeholder="To date"
            className="w-full"
          />
        </div>
      </div>
    </FilterPanel>
  );
};

export default OrdersFilters;
