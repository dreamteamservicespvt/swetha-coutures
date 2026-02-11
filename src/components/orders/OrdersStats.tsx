
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Clock, AlertCircle, CheckCircle, Calendar } from 'lucide-react';

interface OrdersStatsProps {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    ready: number;
    deliveryDeadline: number;
  };
  onStatsCardClick?: (status: string) => void;
}

const OrdersStats: React.FC<OrdersStatsProps> = ({ stats, onStatsCardClick }) => {
  const statsCards = [
    {
      title: "Total Orders",
      value: stats.total,
      icon: Package,
      description: "All time orders",
      color: "text-gray-600 dark:text-gray-400",
      status: "all"
    },
    {
      title: "Pending Orders", 
      value: stats.pending,
      icon: Clock,
      description: "Awaiting processing",
      color: "text-orange-600",
      status: "received"
    },
    {
      title: "In Progress",
      value: stats.inProgress,
      icon: AlertCircle,
      description: "Currently working",
      color: "text-blue-600", 
      status: "in-progress"
    },
    {
      title: "Ready Orders",
      value: stats.ready,
      icon: CheckCircle,
      description: "Ready for pickup",
      color: "text-green-600",
      status: "ready"
    },
    {
      title: "Delivery Deadline",
      value: stats.deliveryDeadline,
      icon: Calendar,
      description: "Due within 5 days",
      color: "text-red-600",
      status: "delivery-deadline"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {statsCards.map((card) => {
        const IconComponent = card.icon;
        return (
          <Card 
            key={card.status}
            className={`border-0 shadow-md hover:shadow-lg transition-all duration-200 ${
              onStatsCardClick ? 'cursor-pointer hover:scale-105' : ''
            }`}
            onClick={() => onStatsCardClick?.(card.status)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <IconComponent className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default OrdersStats;
