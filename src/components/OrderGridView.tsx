
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Eye } from 'lucide-react';
import { Order } from '@/components/orders/OrdersPage';

interface OrderGridViewProps {
  filteredOrders: Order[];
  handleViewOrder: (order: Order) => void;
  handleSendWhatsApp: (order: Order) => void;
  selectedStatus?: string;
  onStatusCardClick?: (status: string) => void;
}

const OrderGridView: React.FC<OrderGridViewProps> = ({
  filteredOrders,
  handleViewOrder,
  handleSendWhatsApp,
  selectedStatus,
  onStatusCardClick
}) => {
  const orders = filteredOrders;
  const statusCounts = {
    received: orders.filter(o => o.status === 'received').length,
    'in-progress': orders.filter(o => o.status === 'in-progress').length,
    ready: orders.filter(o => o.status === 'ready').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    all: orders.length
  };

  // Calculate delivery deadline count (orders due within 5 days)
  const today = new Date();
  const fiveDaysFromNow = new Date(today.getTime() + (5 * 24 * 60 * 60 * 1000));
  const deliveryDeadlineCount = orders.filter(order => {
    if (!order.deliveryDate) return false;
    const deliveryDate = new Date(order.deliveryDate);
    return deliveryDate <= fiveDaysFromNow && deliveryDate >= today;
  }).length;

  const statusCards = [
    { status: 'received', label: 'Order Taken', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200', count: statusCounts.received },
    { status: 'in-progress', label: 'In Progress', color: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200', count: statusCounts['in-progress'] },
    { status: 'ready', label: 'Ready', color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200', count: statusCounts.ready },
    { status: 'delivered', label: 'Delivered', color: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200', count: statusCounts.delivered },
    { status: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200', count: statusCounts.cancelled },
    { status: 'delivery-deadline', label: 'Delivery Deadline', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200', count: deliveryDeadlineCount }
  ];

  const filteredOrdersToShow = selectedStatus && selectedStatus !== 'all' 
    ? orders.filter(order => {
        if (selectedStatus === 'delivery-deadline') {
          const deliveryDate = new Date(order.deliveryDate);
          return deliveryDate <= fiveDaysFromNow && deliveryDate >= today;
        }
        return order.status === selectedStatus;
      })
    : orders;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in-progress': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'ready': return 'bg-green-100 text-green-700 border-green-200';
      case 'delivered': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (!selectedStatus) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statusCards.map(card => (
          <Card 
            key={card.status} 
            className={`cursor-pointer hover:shadow-lg transition-all duration-200 ${card.color} border-2`}
            onClick={() => onStatusCardClick?.(card.status)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.count}</div>
              <p className="text-xs opacity-75 mt-1">
                {card.status === 'delivery-deadline' ? 'Due ≤5 days' : 'orders'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredOrdersToShow.map(order => (
        <Card key={order.id} className="hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div className="font-medium">#{order.orderNumber.slice(-3)}</div>
              <Badge className={getStatusColor(order.status)} variant="outline">
                {order.status}
              </Badge>
            </div>
            <div className="text-lg font-semibold">{order.customerName}</div>
            <div className="text-sm text-gray-500">{order.orderDate}</div>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewOrder(order)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSendWhatsApp(order)}
                className="text-green-600"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default OrderGridView;
