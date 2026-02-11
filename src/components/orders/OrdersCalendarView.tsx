
import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, parseISO, isToday, isBefore } from 'date-fns';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  itemType: string;
  status: 'received' | 'in-progress' | 'ready' | 'delivered' | 'cancelled';
  orderDate: string;
  deliveryDate: string;
  quantity: number;
  totalAmount: number;
  remainingAmount: number;
  items?: any[];
  measurements?: Record<string, string>;
  notes?: string;
  designImages?: string[];
  assignedStaff?: string[];
  requiredMaterials?: any[];
}

interface OrdersCalendarViewProps {
  orders: Order[];
  onDateSelect: (date: Date, dayOrders: Order[]) => void;
}

const OrdersCalendarView: React.FC<OrdersCalendarViewProps> = ({ orders, onDateSelect }) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const ordersByDate = useMemo(() => {
    const grouped: Record<string, { placed: Order[], due: Order[], overdue: Order[], ready: Order[] }> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
    
    orders.forEach(order => {
      try {
        // Parse order date safely
        let orderDate: Date;
        try {
          orderDate = parseISO(order.orderDate);
        } catch {
          orderDate = new Date(order.orderDate);
        }
        
        // Parse delivery date safely  
        let deliveryDate: Date;
        try {
          deliveryDate = parseISO(order.deliveryDate);
        } catch {
          deliveryDate = new Date(order.deliveryDate);
        }

        // Validate dates
        if (isNaN(orderDate.getTime()) || isNaN(deliveryDate.getTime())) {
          console.warn('Invalid date for order:', order.id);
          return;
        }

        const orderDateKey = format(orderDate, 'yyyy-MM-dd');
        const deliveryDateKey = format(deliveryDate, 'yyyy-MM-dd');
        
        // Initialize date entries
        if (!grouped[orderDateKey]) {
          grouped[orderDateKey] = { placed: [], due: [], overdue: [], ready: [] };
        }
        if (!grouped[deliveryDateKey]) {
          grouped[deliveryDateKey] = { placed: [], due: [], overdue: [], ready: [] };
        }
        
        // Orders placed on this date
        grouped[orderDateKey].placed.push(order);
        
        // Orders due on this date
        deliveryDate.setHours(0, 0, 0, 0); // Reset time for comparison
        
        if (order.status === 'ready') {
          grouped[deliveryDateKey].ready.push(order);
        } else if (deliveryDate < today && !['delivered', 'cancelled'].includes(order.status)) {
          grouped[deliveryDateKey].overdue.push(order);
        } else {
          grouped[deliveryDateKey].due.push(order);
        }
      } catch (error) {
        console.warn('Error processing order:', order.id, error);
      }
    });
    
    return grouped;
  }, [orders]);

  const getDayModifiers = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = ordersByDate[dateKey];
    
    if (!dayData) return {};
    
    const hasOverdue = dayData.overdue.length > 0;
    const hasReady = dayData.ready.length > 0;
    const hasDue = dayData.due.length > 0;
    const hasPlaced = dayData.placed.length > 0;
    
    return {
      overdue: hasOverdue,
      ready: hasReady,
      due: hasDue,
      placed: hasPlaced
    };
  };

  const getDayContent = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = ordersByDate[dateKey];
    
    if (!dayData) return null;
    
    return (
      <div className="absolute bottom-0 left-0 right-0 flex justify-center space-x-1 pb-1">
        {dayData.placed.length > 0 && (
          <div className="w-1.5 h-1.5 bg-teal-500 rounded-full"></div>
        )}
        {dayData.due.length > 0 && (
          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
        )}
        {dayData.overdue.length > 0 && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
        )}
        {dayData.ready.length > 0 && (
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
        )}
      </div>
    );
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = ordersByDate[dateKey];
    
    if (dayData) {
      const allDayOrders = [
        ...dayData.placed,
        ...dayData.due,
        ...dayData.overdue,
        ...dayData.ready
      ];
      onDateSelect(date, allDayOrders);
    } else {
      onDateSelect(date, []);
    }
  };

  const selectedDateData = useMemo(() => {
    if (!selectedDate) return null;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return ordersByDate[dateKey];
  }, [selectedDate, ordersByDate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Order Calendar</CardTitle>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                <span>Orders Placed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>Due Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Overdue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Ready for Pickup</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="rounded-md border"
              components={{
                Day: ({ date, ...otherProps }) => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const dayData = ordersByDate[dateKey];
                  const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === dateKey;
                  
                  return (
                    <div className="relative h-9 w-9">
                      <button 
                        className={`w-full h-full text-sm p-0 font-normal rounded-md transition-colors ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
                        }`}
                        onClick={() => handleDateSelect(date)}
                        type="button"
                      >
                        {date.getDate()}
                        {dayData && (
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex space-x-0.5">
                            {dayData.placed.length > 0 && (
                              <div key={`placed-${dateKey}`} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white dark:bg-gray-900' : 'bg-teal-500'}`}></div>
                            )}
                            {dayData.due.length > 0 && (
                              <div key={`due-${dateKey}`} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white dark:bg-gray-900' : 'bg-orange-500'}`}></div>
                            )}
                            {dayData.overdue.length > 0 && (
                              <div key={`overdue-${dateKey}`} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white dark:bg-gray-900' : 'bg-red-500'}`}></div>
                            )}
                            {dayData.ready.length > 0 && (
                              <div key={`ready-${dateKey}`} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white dark:bg-gray-900' : 'bg-green-500'}`}></div>
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                }
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Selected Date Details */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a Date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateData ? (
              <div className="space-y-4">
                {selectedDateData.placed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-teal-700 mb-2">Orders Placed ({selectedDateData.placed.length})</h4>
                    {selectedDateData.placed.slice(0, 3).map((order, orderIndex) => (
                      <div key={`placed-${order.id}-${orderIndex}`} className="text-sm p-2 bg-teal-50 rounded mb-1 cursor-pointer hover:bg-teal-100 transition-colors"
                           onClick={() => onDateSelect(selectedDate!, [order])}>
                        #{order.orderNumber.slice(-4)} - {order.customerName}
                      </div>
                    ))}
                    {selectedDateData.placed.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{selectedDateData.placed.length - 3} more
                      </div>
                    )}
                  </div>
                )}

                {selectedDateData.due.length > 0 && (
                  <div>
                    <h4 className="font-medium text-orange-700 mb-2">Due Today ({selectedDateData.due.length})</h4>
                    {selectedDateData.due.slice(0, 3).map((order, orderIndex) => (
                      <div key={`due-${order.id}-${orderIndex}`} className="text-sm p-2 bg-orange-50 rounded mb-1 cursor-pointer hover:bg-orange-100 transition-colors"
                           onClick={() => onDateSelect(selectedDate!, [order])}>
                        #{order.orderNumber.slice(-4)} - {order.customerName}
                      </div>
                    ))}
                  </div>
                )}

                {selectedDateData.overdue.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-700 mb-2">Overdue ({selectedDateData.overdue.length})</h4>
                    {selectedDateData.overdue.slice(0, 3).map((order, orderIndex) => (
                      <div key={`overdue-${order.id}-${orderIndex}`} className="text-sm p-2 bg-red-50 rounded mb-1 cursor-pointer hover:bg-red-100 transition-colors"
                           onClick={() => onDateSelect(selectedDate!, [order])}>
                        #{order.orderNumber.slice(-4)} - {order.customerName}
                      </div>
                    ))}
                  </div>
                )}

                {selectedDateData.ready.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-700 mb-2">Ready for Pickup ({selectedDateData.ready.length})</h4>
                    {selectedDateData.ready.slice(0, 3).map((order, orderIndex) => (
                      <div key={`ready-${order.id}-${orderIndex}`} className="text-sm p-2 bg-green-50 rounded mb-1 cursor-pointer hover:bg-green-100 transition-colors"
                           onClick={() => onDateSelect(selectedDate!, [order])}>
                        #{order.orderNumber.slice(-4)} - {order.customerName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>No orders for this date</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrdersCalendarView;
