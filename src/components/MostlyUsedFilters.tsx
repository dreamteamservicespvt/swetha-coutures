
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Package, Tag } from 'lucide-react';
import { useInventoryStats } from '@/hooks/useInventoryStats';
import { Skeleton } from '@/components/ui/skeleton';

interface MostlyUsedFiltersProps {
  onCategoryFilter: (category: string) => void;
  onTypeFilter: (type: string) => void;
  selectedCategory: string;
  selectedType: string;
  onClearFilters: () => void;
}

const MostlyUsedFilters = ({
  onCategoryFilter,
  onTypeFilter,
  selectedCategory,
  selectedType,
  onClearFilters
}: MostlyUsedFiltersProps) => {
  const { categories, types, loading, error } = useInventoryStats();

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span>Mostly Used</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <div className="flex flex-wrap gap-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-24" />
              ))}
            </div>
          </div>
          <div>
            <Skeleton className="h-4 w-16 mb-2" />
            <div className="flex flex-wrap gap-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-20" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <p className="text-sm text-yellow-700">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const hasActiveFilters = selectedCategory || selectedType;

  return (
    <Card className="mb-6 border-0 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span>Mostly Used</span>
          </CardTitle>
          {hasActiveFilters && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClearFilters}
              className="text-gray-600 dark:text-gray-400"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Categories */}
        {categories.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Tag className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Categories</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(({ category, count }) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => onCategoryFilter(category)}
                  className={`h-8 text-xs ${
                    selectedCategory === category 
                      ? 'bg-blue-600 text-white' 
                      : 'hover:bg-blue-50 hover:border-blue-300'
                  }`}
                >
                  {category}
                  <Badge 
                    variant="secondary" 
                    className="ml-2 h-4 text-xs bg-white dark:bg-gray-900/20 text-current border-0"
                  >
                    {count}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Types */}
        {types.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Package className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Types</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {types.map(({ type, count }) => (
                <Button
                  key={type}
                  variant={selectedType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTypeFilter(type)}
                  className={`h-8 text-xs ${
                    selectedType === type 
                      ? 'bg-purple-600 text-white' 
                      : 'hover:bg-purple-50 hover:border-purple-300'
                  }`}
                >
                  {type}
                  <Badge 
                    variant="secondary" 
                    className="ml-2 h-4 text-xs bg-white dark:bg-gray-900/20 text-current border-0"
                  >
                    {count}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {categories.length === 0 && types.length === 0 && (
          <div className="text-center py-4">
            <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">No usage data available yet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Start taking orders to see popular items</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MostlyUsedFilters;
