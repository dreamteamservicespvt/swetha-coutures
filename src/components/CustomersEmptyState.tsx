
import React from 'react';
import { Button } from '@/components/ui/button';
import { Users, Plus } from 'lucide-react';

interface CustomersEmptyStateProps {
  searchTerm: string;
  onAddCustomer: () => void;
}

const CustomersEmptyState: React.FC<CustomersEmptyStateProps> = ({ searchTerm, onAddCustomer }) => {
  return (
    <div className="text-center py-12">
      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
      <p className="text-gray-600 mb-4">
        {searchTerm ? 'No customers match your search.' : 'Start by adding your first customer.'}
      </p>
      {!searchTerm && (
        <Button 
          className="bg-gradient-to-r from-blue-600 to-purple-600"
          onClick={onAddCustomer}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add First Customer
        </Button>
      )}
    </div>
  );
};

export default CustomersEmptyState;
