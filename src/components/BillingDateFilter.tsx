
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Calendar, X } from 'lucide-react';

interface BillingDateFilterProps {
  onDateFilter: (startDate: Date | null, endDate: Date | null) => void;
  loading?: boolean;
}

const BillingDateFilter: React.FC<BillingDateFilterProps> = ({ onDateFilter, loading }) => {
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [filterMode, setFilterMode] = useState<'single' | 'range'>('single');

  const handleApplyFilter = () => {
    if (filterMode === 'single' && singleDate) {
      // For single date, set both start and end to the same date (full day)
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
    onDateFilter(null, null);
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2">
              <Button
                variant={filterMode === 'single' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('single')}
              >
                📅 Single Date
              </Button>
              <Button
                variant={filterMode === 'range' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('range')}
              >
                📆 Date Range
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {filterMode === 'single' ? (
              <div className="space-y-2">
                <Label>Select Date</Label>
                <DatePicker
                  date={singleDate}
                  onDateChange={setSingleDate}
                  placeholder="Pick a date"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <DatePicker
                    date={startDate}
                    onDateChange={setStartDate}
                    placeholder="Start date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <DatePicker
                    date={endDate}
                    onDateChange={setEndDate}
                    placeholder="End date"
                  />
                </div>
              </>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={handleApplyFilter}
                disabled={
                  loading ||
                  (filterMode === 'single' && !singleDate) ||
                  (filterMode === 'range' && (!startDate || !endDate))
                }
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Apply Filter
              </Button>
              <Button
                variant="outline"
                onClick={handleClearFilter}
                disabled={loading}
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

export default BillingDateFilter;
