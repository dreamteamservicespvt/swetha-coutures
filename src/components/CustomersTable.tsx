
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2 } from 'lucide-react';
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
  totalSpent?: number;
  lastOrderDate?: string;
  customerType: 'regular' | 'premium' | 'vip';
  createdAt: any;
}

interface CustomersTableProps {
  customers: Customer[];
  selectedCustomers: Set<string>;
  isSelectAll: boolean;
  searchTerm: string;
  onSelectCustomer: (customerId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onCustomerClick: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
  onAddCustomer: () => void;
}

const CustomersTable: React.FC<CustomersTableProps> = ({
  customers,
  selectedCustomers,
  isSelectAll,
  searchTerm,
  onSelectCustomer,
  onSelectAll,
  onCustomerClick,
  onEdit,
  onDelete,
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

  const MobileCustomerCard = ({ customer }: { customer: Customer }) => (
    <div className="mobile-item-card card-dark-fix">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2 flex-1">
          <Checkbox
            checked={selectedCustomers.has(customer.id)}
            onCheckedChange={(checked) => onSelectCustomer(customer.id, checked as boolean)}
            className="touch-target"
          />
          <div className="flex-1 min-w-0" onClick={() => onCustomerClick(customer)}>
            <div className="font-medium text-dark-fix truncate">{customer.name || 'N/A'}</div>
            <div className="responsive-text-sm text-muted-dark-fix truncate">{customer.email || 'No email'}</div>
          </div>
        </div>
        <Badge className={`${getCustomerTypeColor(customer.customerType)} badge-dark-fix`} variant="outline">
          {customer.customerType || 'regular'}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-2 responsive-text-sm">
        <div>
          <span className="text-muted-dark-fix">Phone:</span>
          <div className="flex items-center space-x-1">
            <span className="text-dark-fix truncate">{customer.phone || 'N/A'}</span>
            {customer.phone && (
              <ContactActions 
                phone={customer.phone}
                message={`Hi ${customer.name}, thank you for choosing Swetha's Couture! How can we assist you today?`}
              />
            )}
          </div>
        </div>
        <div>
          <span className="text-muted-dark-fix">Location:</span>
          <div className="text-dark-fix truncate">{customer.city || 'N/A'}</div>
        </div>
        <div>
          <span className="text-muted-dark-fix">Orders:</span>
          <div className="text-dark-fix">{customer.totalOrders || 0}</div>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Total Spent:</span>
          <div className="text-gray-900 dark:text-gray-100">₹{(customer.totalSpent || 0).toLocaleString()}</div>
        </div>
      </div>
      
      <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Last Order: {customer.lastOrderDate || 'Never'}
        </div>
        <div className="flex space-x-1">
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
      </div>
    </div>
  );

  return (
    <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-gray-100">Customers</CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">Manage customer information and contact details</CardDescription>
      </CardHeader>
      <CardContent>
        {customers.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <div className="table-horizontal-scroll">
                <Table className="table-dark-fix">
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-gray-700">
                      <TableHead className="w-12 text-dark-fix">
                        <Checkbox
                          checked={isSelectAll}
                          onCheckedChange={onSelectAll}
                        />
                      </TableHead>
                      <TableHead className="text-dark-fix">Customer</TableHead>
                      <TableHead className="text-dark-fix">Contact</TableHead>
                      <TableHead className="text-dark-fix">Location</TableHead>
                      <TableHead className="text-dark-fix">Type</TableHead>
                      <TableHead className="text-dark-fix">Orders</TableHead>
                      <TableHead className="text-dark-fix">Total Spent</TableHead>
                      <TableHead className="text-dark-fix">Last Order</TableHead>
                      <TableHead className="text-dark-fix">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700">
                        <TableCell>
                          <Checkbox
                            checked={selectedCustomers.has(customer.id)}
                            onCheckedChange={(checked) => onSelectCustomer(customer.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)} className="table-cell-responsive">
                          <div>
                            <div className="font-medium text-dark-fix">{customer.name || 'N/A'}</div>
                            <div className="text-sm text-muted-dark-fix">{customer.email || 'No email'}</div>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)} className="table-cell-responsive">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-dark-fix">{customer.phone || 'N/A'}</span>
                            {customer.phone && (
                              <ContactActions 
                                phone={customer.phone}
                                message={`Hi ${customer.name}, thank you for choosing Swetha's Couture! How can we assist you today?`}
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)} className="table-cell-responsive">
                          <div>
                            <div className="font-medium text-dark-fix">{customer.city || 'N/A'}</div>
                            <div className="text-sm text-muted-dark-fix">{customer.pincode || ''}</div>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)}>
                          <Badge className={getCustomerTypeColor(customer.customerType)} variant="outline">
                            {customer.customerType || 'regular'}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)} className="text-dark-fix">{customer.totalOrders || 0}</TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)} className="text-dark-fix">₹{(customer.totalSpent || 0).toLocaleString()}</TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)} className="text-dark-fix table-cell-responsive">{customer.lastOrderDate || 'Never'}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(customer);
                              }}
                              className="button-dark-fix"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(customer.id);
                              }}
                              className="button-dark-fix text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="table-scroll-hint">
                  
                </div>
              </div>
            </div>

            {/* Tablet Horizontal Scroll View */}
            <div className="hidden md:block lg:hidden">
              <div className="table-horizontal-scroll">
                <Table className="table-dark-fix">
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-gray-700">
                      <TableHead className="w-12 text-dark-fix">
                        <Checkbox
                          checked={isSelectAll}
                          onCheckedChange={onSelectAll}
                        />
                      </TableHead>
                      <TableHead className="text-dark-fix">Customer</TableHead>
                      <TableHead className="text-dark-fix">Contact</TableHead>
                      <TableHead className="text-dark-fix">Location</TableHead>
                      <TableHead className="text-dark-fix">Type</TableHead>
                      <TableHead className="text-dark-fix">Orders</TableHead>
                      <TableHead className="text-dark-fix">Total Spent</TableHead>
                      <TableHead className="text-dark-fix">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700">
                        <TableCell>
                          <Checkbox
                            checked={selectedCustomers.has(customer.id)}
                            onCheckedChange={(checked) => onSelectCustomer(customer.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)}>
                          <div>
                            <div className="font-medium text-dark-fix">{customer.name || 'N/A'}</div>
                            <div className="text-sm text-muted-dark-fix">{customer.email || 'No email'}</div>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)}>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-dark-fix">{customer.phone || 'N/A'}</span>
                            {customer.phone && (
                              <ContactActions 
                                phone={customer.phone}
                                message={`Hi ${customer.name}, thank you for choosing Swetha's Couture! How can we assist you today?`}
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)}>
                          <div>
                            <div className="font-medium text-dark-fix">{customer.city || 'N/A'}</div>
                            <div className="text-sm text-muted-dark-fix">{customer.pincode || ''}</div>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)}>
                          <Badge className={getCustomerTypeColor(customer.customerType)} variant="outline">
                            {customer.customerType || 'regular'}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)} className="text-dark-fix">{customer.totalOrders || 0}</TableCell>
                        <TableCell onClick={() => onCustomerClick(customer)} className="text-dark-fix">₹{(customer.totalSpent || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(customer);
                              }}
                              className="button-dark-fix"
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
                              className="button-dark-fix text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="table-scroll-hint">
                  
                </div>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={isSelectAll}
                    onCheckedChange={onSelectAll}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Select All</span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{customers.length} customers</span>
              </div>
              {customers.map((customer) => (
                <MobileCustomerCard key={customer.id} customer={customer} />
              ))}
            </div>
          </>
        ) : (
          <CustomersEmptyState
            searchTerm={searchTerm}
            onAddCustomer={onAddCustomer}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default CustomersTable;
