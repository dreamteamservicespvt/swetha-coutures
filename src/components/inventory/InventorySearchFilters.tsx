
import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { List, Grid } from 'lucide-react';
import FilterPanel from '@/components/FilterPanel';

interface InventoryCategory {
  id: string;
  name: string;
}

interface InventoryType {
  id: string;
  name: string;
}

interface InventorySearchFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
  typeFilter: string;
  setTypeFilter: (type: string) => void;
  categories: InventoryCategory[];
  types: InventoryType[];
  viewMode: 'table' | 'grid';
  setViewMode: (mode: 'table' | 'grid') => void;
  /** Date controls, folded into the same collapsible panel instead of a card of their own. */
  dateFilters?: React.ReactNode;
  dateFilterActive?: boolean;
}

const InventorySearchFilters: React.FC<InventorySearchFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  typeFilter,
  setTypeFilter,
  categories,
  types,
  viewMode,
  setViewMode,
  dateFilters,
  dateFilterActive = false,
}) => {
  const activeCount =
    (categoryFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0) + (dateFilterActive ? 1 : 0);
  const summaryParts: string[] = [];
  if (categoryFilter !== 'all') summaryParts.push(categoryFilter);
  if (typeFilter !== 'all') summaryParts.push(typeFilter);
  if (dateFilterActive) summaryParts.push('date range');

  return (
    <FilterPanel
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Search items by name, category or supplier…"
      activeCount={activeCount}
      summary={summaryParts.length > 0 ? `Showing: ${summaryParts.join(' · ')}` : undefined}
      onClearAll={() => {
        setCategoryFilter('all');
        setTypeFilter('all');
      }}
      actions={
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="h-8 px-2"
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 px-2"
            aria-label="Grid view"
          >
            <Grid className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map(type => (
                <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {dateFilters && <div className="border-t pt-3 dark:border-gray-700">{dateFilters}</div>}
    </FilterPanel>
  );
};

export default InventorySearchFilters;
