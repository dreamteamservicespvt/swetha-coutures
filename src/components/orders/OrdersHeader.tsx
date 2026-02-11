
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, List, Grid, Calendar as CalendarIcon, Menu } from 'lucide-react';

interface OrdersHeaderProps {
  view: 'list' | 'grid' | 'calendar';
  setView: (view: 'list' | 'grid' | 'calendar') => void;
  setSelectedGridStatus: (status: string | null) => void;
  setIsCreateModalOpen: (open: boolean) => void;
  adaptiveView: 'list' | 'grid';
  onToggleSidebar?: () => void;
}

const OrdersHeader: React.FC<OrdersHeaderProps> = ({
  view,
  setView,
  setSelectedGridStatus,
  setIsCreateModalOpen,
  adaptiveView,
  onToggleSidebar
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
      <div className="flex items-center space-x-4">
        {onToggleSidebar && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSidebar}
            className="md:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage customer orders and track progress</p>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        {/* Manual View Toggle - only show when not in calendar view */}
        {view !== 'calendar' && (
          <div className="flex rounded-lg border bg-white dark:bg-gray-900">
            <Button
              variant={view === 'list' && adaptiveView === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setView('list');
                setSelectedGridStatus(null);
              }}
              className="rounded-r-none"
              title="List View"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'grid' || adaptiveView === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setView('grid');
                setSelectedGridStatus(null);
              }}
              className="rounded-l-none"
              title="Grid View"
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {/* Calendar View Toggle */}
        <Button
          variant={view === 'calendar' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setView('calendar');
            setSelectedGridStatus(null);
          }}
          title="Calendar View"
        >
          <CalendarIcon className="h-4 w-4" />
        </Button>
        
        <Button 
          className="bg-gradient-to-r from-blue-600 to-purple-600"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>
    </div>
  );
};

export default OrdersHeader;
