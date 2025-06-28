
import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, parseISO } from 'date-fns';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  itemType: string;
  status: string;
  orderDate: string;
  deliveryDate: string;
  totalAmount: number;
}

interface OrderCalendarProps {
  orders: Order[];
  onDateSelect: (date: Date, dayOrders: Order[]) => void;
}

const OrderCalendar: React.FC<OrderCalendarProps> = ({ orders, onDateSelect }) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const ordersByDate = useMemo(() => {
    const grouped: Record<string, { placed: Order[], due: Order[], overdue: Order[], ready: Order[] }> = {};
    
    orders.forEach(order => {
      const orderDateKey = order.orderDate;
      const deliveryDateKey = order.deliveryDate;
      const today = new Date();
      const deliveryDate = parseISO(order.deliveryDate);
      
      // Orders placed on this date
      if (!grouped[orderDateKey]) {
        grouped[orderDateKey] = { placed: [], due: [], overdue: [], ready: [] };
      }
      grouped[orderDateKey].placed.push(order);
      
      // Orders due on this date
      if (!grouped[deliveryDateKey]) {
        grouped[deliveryDateKey] = { placed: [], due: [], overdue: [], ready: [] };
      }
      
      if (order.status === 'ready') {
        grouped[deliveryDateKey].ready.push(order);
      } else if (deliveryDate < today && !['delivered', 'cancelled'].includes(order.status)) {
        grouped[deliveryDateKey].overdue.push(order);
      } else {
        grouped[deliveryDateKey].due.push(order);
      }
    });
    
    return grouped;
  }, [orders]);

  const getDayContent = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = ordersByDate[dateKey];
    
    if (!dayData) return null;
    
    return (
      <div className="absolute bottom-0 left-0 right-0 flex justify-center space-x-1">
        {dayData.placed.length > 0 && (
          <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
        )}
        {dayData.due.length > 0 && (
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
        )}
        {dayData.overdue.length > 0 && (
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        )}
        {dayData.ready.length > 0 && (
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
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
                Day: ({ date, ...props }) => (
                  <div className="relative">
                    <button {...props} className="relative w-full h-full">
                      {format(date, 'd')}
                      {getDayContent(date)}
                    </button>
                  </div>
                )
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
                    {selectedDateData.placed.slice(0, 3).map(order => (
                      <div key={order.id} className="text-sm p-2 bg-teal-50 rounded mb-1">
                        #{order.orderNumber.slice(-4)} - {order.customerName}
                      </div>
                    ))}
                    {selectedDateData.placed.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{selectedDateData.placed.length - 3} more
                      </div>
                    )}
                  </div>
                )}

                {selectedDateData.due.length > 0 && (
                  <div>
                    <h4 className="font-medium text-orange-700 mb-2">Due Today ({selectedDateData.due.length})</h4>
                    {selectedDateData.due.slice(0, 3).map(order => (
                      <div key={order.id} className="text-sm p-2 bg-orange-50 rounded mb-1">
                        #{order.orderNumber.slice(-4)} - {order.customerName}
                      </div>
                    ))}
                  </div>
                )}

                {selectedDateData.overdue.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-700 mb-2">Overdue ({selectedDateData.overdue.length})</h4>
                    {selectedDateData.overdue.slice(0, 3).map(order => (
                      <div key={order.id} className="text-sm p-2 bg-red-50 rounded mb-1">
                        #{order.orderNumber.slice(-4)} - {order.customerName}
                      </div>
                    ))}
                  </div>
                )}

                {selectedDateData.ready.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-700 mb-2">Ready for Pickup ({selectedDateData.ready.length})</h4>
                    {selectedDateData.ready.slice(0, 3).map(order => (
                      <div key={order.id} className="text-sm p-2 bg-green-50 rounded mb-1">
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

export default OrderCalendar;
