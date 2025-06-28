
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface InventoryDateFiltersProps {
  dateField: 'broughtAt' | 'usedAt' | 'createdAt';
  setDateField: (field: 'broughtAt' | 'usedAt' | 'createdAt') => void;
  dateFilterMode: 'single' | 'range';
  setDateFilterMode: (mode: 'single' | 'range') => void;
  singleDate: Date | undefined;
  setSingleDate: (date: Date | undefined) => void;
  startDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
  onDateChange: () => void;
  onClearFilters: () => void;
}

const InventoryDateFilters: React.FC<InventoryDateFiltersProps> = ({
  dateField,
  setDateField,
  dateFilterMode,
  setDateFilterMode,
  singleDate,
  setSingleDate,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onDateChange,
  onClearFilters
}) => {
  const handleSingleDateChange = (date: Date | undefined) => {
    setSingleDate(date);
    if (date) onDateChange();
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    if (date && startDate) onDateChange();
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <span>Date Filters</span>
        </CardTitle>
        <CardDescription>Filter inventory by dates</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <Select value={dateField} onValueChange={setDateField}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Date field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Created Date</SelectItem>
              <SelectItem value="broughtAt">Brought Date</SelectItem>
              <SelectItem value="usedAt">Used Date</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilterMode} onValueChange={setDateFilterMode}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Date</SelectItem>
              <SelectItem value="range">Date Range</SelectItem>
            </SelectContent>
          </Select>

          {dateFilterMode === 'single' ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-60 justify-start text-left font-normal",
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
                  onSelect={handleSingleDateChange}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="flex gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-40 justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span>to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-40 justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>End date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={handleEndDateChange}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <Button 
            variant="outline" 
            onClick={onClearFilters}
            className="flex items-center space-x-1"
          >
            <X className="h-4 w-4" />
            <span>Clear</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InventoryDateFilters;
