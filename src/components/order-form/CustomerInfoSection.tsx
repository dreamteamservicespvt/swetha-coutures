
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
}

const CustomerInfoSection: React.FC<CustomerInfoSectionProps> = ({
  register,
  errors,
  setValue,
  customerNameValue,
  customers,
  showCustomerSuggestions,
  setShowCustomerSuggestions
}) => {
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerNameValue?.toLowerCase() || '')
  );

  const selectCustomer = (customer: any) => {
    setValue('customerName', customer.name);
    setValue('customerPhone', customer.phone || '');
    setValue('customerEmail', customer.email || '');
    setShowCustomerSuggestions(false);
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
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {filteredCustomers.slice(0, 5).map((customer) => (
                  <div
                    key={customer.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => selectCustomer(customer)}
                  >
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-gray-600">{customer.phone}</div>
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
