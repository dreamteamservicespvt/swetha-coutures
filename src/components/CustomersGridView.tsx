import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2, User, Phone, Mail, MapPin, Package, TrendingUp, MessageSquare, FileText } from 'lucide-react';
import ContactActions from '@/components/ContactActions';
import CustomersEmptyState from './CustomersEmptyState';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  pincode?: string;
  notes?: string;
  totalOrders?: number;
  totalBills?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  customerType: 'regular' | 'premium' | 'vip';
  createdAt: any;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
}

interface CustomersGridViewProps {
  customers: Customer[];
  selectedCustomers: Set<string>;
  searchTerm: string;
  onSelectCustomer: (customerId: string, checked: boolean) => void;
  onCustomerClick: (customer: Customer, initialTab?: 'orders' | 'bills') => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
  onWhatsApp: (customer: Customer) => void;
  onAddCustomer: () => void;
}

const CustomersGridView: React.FC<CustomersGridViewProps> = ({
  customers,
  selectedCustomers,
  searchTerm,
  onSelectCustomer,
  onCustomerClick,
  onEdit,
  onDelete,
  onWhatsApp,
  onAddCustomer
}) => {
  const getCustomerTypeColor = (type: Customer['customerType']) => {
    switch (type) {
      case 'regular': return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
      case 'premium': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700';
      case 'vip': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700';
      default: return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getCustomerTypeIcon = (type: Customer['customerType']) => {
    switch (type) {
      case 'premium': return '⭐';
      case 'vip': return '👑';
      default: return '👤';
    }
  };

  if (customers.length === 0) {
    return (
      <div className="col-span-full">
        <CustomersEmptyState
          searchTerm={searchTerm}
          onAddCustomer={onAddCustomer}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {customers.map((customer) => (
        <Card 
          key={customer.id} 
          className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          onClick={() => onCustomerClick(customer)}
        >
          <CardContent className="p-4">
            {/* Header with checkbox and type badge */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedCustomers.has(customer.id)}
                    onCheckedChange={(checked) => {
                      onSelectCustomer(customer.id, checked as boolean);
                    }}
                    className="touch-target"
                  />
                </div>
                <div className="text-2xl">
                  {getCustomerTypeIcon(customer.customerType)}
                </div>
              </div>
              <Badge 
                className={`${getCustomerTypeColor(customer.customerType)} text-xs`} 
                variant="outline"
              >
                {customer.customerType || 'regular'}
              </Badge>
            </div>

            {/* Customer Name */}
            <div className="mb-3">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">
                {customer.name || 'N/A'}
              </h3>
              {customer.email && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {customer.email}
                </p>
              )}
            </div>

            {/* Contact Information */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
                  {customer.phone || 'N/A'}
                </span>
                {customer.phone && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex"
                  >
                    <ContactActions 
                      phone={customer.phone}
                      message={`Hi ${customer.name}, thank you for choosing us! How can we assist you today?`}
                    />
                  </div>
                )}
              </div>
              
              {customer.city && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300 truncate">
                    {customer.city}
                  </span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="space-y-2 mb-4">
              {/* First Row: Orders and Bills */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                     onClick={(e) => {
                       e.stopPropagation();
                       onCustomerClick(customer);
                     }}>
                  <Package className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Orders</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {customer.totalOrders || 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                     onClick={(e) => {
                       e.stopPropagation();
                       onCustomerClick(customer, 'bills');
                     }}>
                  <FileText className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Bills</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {customer.totalBills || 0}
                    </p>
                  </div>
                </div>
              </div>
              {/* Second Row: Spent (full width) */}
              <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Spent</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    ₹{(customer.totalSpent || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Last Order Date */}
            {customer.lastOrderDate && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Last Order: {customer.lastOrderDate}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 transition-opacity">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onWhatsApp(customer);
                }}
                className="h-8 w-8 p-0 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
              >
                <MessageSquare className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(customer);
                }}
                className="h-8 w-8 p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(customer.id);
                }}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CustomersGridView;
