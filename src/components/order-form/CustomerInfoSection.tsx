
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { User, Phone, Mail } from 'lucide-react';
import { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { OrderFormData } from '@/types/orderTypes';

interface CustomerInfoSectionProps {
  register: UseFormRegister<OrderFormData>;
  errors: FieldErrors<OrderFormData>;
  setValue: UseFormSetValue<OrderFormData>;
  customerNameValue: string;
  customers: any[];
  showCustomerSuggestions: boolean;
  setShowCustomerSuggestions: (show: boolean) => void;
  onCustomerSelect?: (customer: any) => void; // New callback for enhanced customer selection
}

const CustomerInfoSection: React.FC<CustomerInfoSectionProps> = ({
  register,
  errors,
  setValue,
  customerNameValue,
  customers,
  showCustomerSuggestions,
  setShowCustomerSuggestions,
  onCustomerSelect
}) => {
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerNameValue?.toLowerCase() || '')
  );

  const selectCustomer = (customer: any) => {
    setValue('customerName', customer.name);
    setValue('customerPhone', customer.phone || '');
    setValue('customerEmail', customer.email || '');
    // Note: customerAddress field would need to be added to OrderFormData type
    setShowCustomerSuggestions(false);
    
    // Call the enhanced callback if provided
    if (onCustomerSelect) {
      onCustomerSelect(customer);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="h-5 w-5 mr-2" />
          Customer Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Label htmlFor="customerName">Customer Name *</Label>
            <Input
              id="customerName"
              {...register('customerName', { required: 'Customer name is required' })}
              placeholder="Enter customer name"
              className={errors.customerName ? 'border-red-500' : ''}
            />
            {errors.customerName && (
              <p className="text-red-500 text-sm mt-1">{errors.customerName.message}</p>
            )}
            
            {/* Customer Suggestions */}
            {showCustomerSuggestions && filteredCustomers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredCustomers.slice(0, 5).map((customer) => (
                  <div
                    key={customer.id}
                    className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0"
                    onClick={() => selectCustomer(customer)}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{customer.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{customer.phone}</div>
                    {customer.email && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 dark:text-gray-400">{customer.email}</div>
                    )}
                    {customer.address && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 truncate">{customer.address}</div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                        {customer.totalOrders || 0} orders
                      </span>
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                        ₹{(customer.totalSpent || 0).toLocaleString()}
                      </span>
                      <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
                        {customer.customerType || 'regular'}
                      </span>
                    </div>
                    {customer.lastOrderDate && (
                      <div className="text-xs text-gray-400 mt-1">
                        Last order: {customer.lastOrderDate}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <Label htmlFor="customerPhone">Phone Number *</Label>
            <Input
              id="customerPhone"
              {...register('customerPhone', { required: 'Phone number is required' })}
              placeholder="Enter phone number"
              className={errors.customerPhone ? 'border-red-500' : ''}
            />
            {errors.customerPhone && (
              <p className="text-red-500 text-sm mt-1">{errors.customerPhone.message}</p>
            )}
          </div>
          
          <div>
            <Label htmlFor="customerEmail">Email (Optional)</Label>
            <Input
              id="customerEmail"
              type="email"
              {...register('customerEmail')}
              placeholder="Enter email address"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerInfoSection;
