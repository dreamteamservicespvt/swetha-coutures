
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, TrendingUp, AlertTriangle, TrendingDown } from 'lucide-react';

interface InventoryStatsProps {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  categoriesCount: number;
}

const InventoryStats: React.FC<InventoryStatsProps> = ({
  totalItems,
  totalValue,
  lowStockCount,
  categoriesCount
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Items</CardTitle>
          <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{totalItems}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Across all categories</p>
        </CardContent>
      </Card>
      
      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Value</CardTitle>
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">₹{totalValue.toLocaleString()}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Current inventory value</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Low Stock</CardTitle>
          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{lowStockCount}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Items need reordering</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Categories</CardTitle>
          <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{categoriesCount}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Product categories</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryStats;
