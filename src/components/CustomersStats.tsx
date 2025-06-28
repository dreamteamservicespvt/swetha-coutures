
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Star, TrendingUp } from 'lucide-react';

interface Customer {
  id: string;
  customerType: 'regular' | 'premium' | 'vip';
  totalSpent?: number;
}

interface CustomersStatsProps {
  customers: Customer[];
}

const CustomersStats: React.FC<CustomersStatsProps> = ({ customers }) => {
  const totalCustomers = customers.length;
  const premiumCustomers = customers.filter(c => c.customerType === 'premium').length;
  const vipCustomers = customers.filter(c => c.customerType === 'vip').length;
  const totalRevenue = customers.reduce((sum, customer) => 
    sum + (customer.totalSpent || 0), 0
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Customers</CardTitle>
          <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCustomers}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">All registered customers</p>
        </CardContent>
      </Card>
      
      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Premium Customers</CardTitle>
          <Star className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{premiumCustomers}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Premium tier customers</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">VIP Customers</CardTitle>
          <Star className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{vipCustomers}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">VIP tier customers</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">₹{totalRevenue.toLocaleString()}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">From all customers</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomersStats;
