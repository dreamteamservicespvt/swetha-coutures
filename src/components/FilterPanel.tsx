import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, SlidersHorizontal, ChevronDown, ChevronRight, X } from 'lucide-react';

interface FilterPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** The filter controls themselves — revealed when the panel is expanded. */
  children?: React.ReactNode;
  /** How many filters are currently narrowing the list, shown on the collapsed header. */
  activeCount?: number;
  onClearAll?: () => void;
  /** Short line describing what is currently being shown. */
  summary?: string;
  /** Extra controls that stay visible when collapsed (view toggles, export…). */
  actions?: React.ReactNode;
}

/**
 * One search-and-filter panel used across every list page.
 *
 * Search stays visible because it is what people reach for first; everything else is behind
 * a toggle that starts **closed**. On a phone the old always-expanded filter blocks pushed
 * the actual data below the fold on every page, which is the opposite of useful — the count
 * badge and summary line mean nothing is hidden without a trace.
 */
const FilterPanel: React.FC<FilterPanelProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search…',
  children,
  activeCount = 0,
  onClearAll,
  summary,
  actions,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="p-3 pb-0 sm:p-4 sm:pb-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 pl-10 text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {children && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen((value) => !value)}
                className="h-10 flex-1 sm:flex-none"
              >
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                Filters
                {activeCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[11px]">
                    {activeCount}
                  </Badge>
                )}
                {open ? (
                  <ChevronDown className="ml-1 h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-1 h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {summary && (
          <CardDescription className="pb-3 pt-2 text-xs sm:text-sm">{summary}</CardDescription>
        )}
      </CardHeader>

      {open && children && (
        <CardContent className="space-y-3 p-3 pt-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Filters</CardTitle>
            {onClearAll && activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-7 text-xs text-red-600 hover:bg-red-50"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear all
              </Button>
            )}
          </div>
          {children}
        </CardContent>
      )}
    </Card>
  );
};

export default FilterPanel;
