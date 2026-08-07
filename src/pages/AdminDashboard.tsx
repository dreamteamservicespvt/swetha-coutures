import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealTimeStats } from '@/hooks/useRealTimeData';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Users,
  Calendar,
  AlertTriangle,
  Receipt,
  Package,
  Truck,
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import IncomeExpensesCard from '@/components/admin/IncomeExpensesCard';
import PendingPaymentsPanel from '@/components/admin/PendingPaymentsPanel';
import PendingBillsPanel from '@/components/admin/PendingBillsPanel';
import { formatCurrency } from '@/utils/billingUtils';

/**
 * Admin dashboard, rebuilt around things that need *action* (Req 6).
 *
 * Vanity metrics (total orders, lifetime revenue, ready-for-delivery counts) and the
 * duplicated Attendance / Analytics / ROI tabs were removed — each already has its own
 * page in the sidebar. What is left is the collections queue, pending bills, and the few
 * counters that mean "someone has to do something today".
 */
const AdminDashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const { stats, loading, error } = useRealTimeStats();

  const [collections, setCollections] = useState({ outstanding: 0, debtors: 0, bills: 0 });
  const [alterationsPending, setAlterationsPending] = useState(0);

  // Redirect staff to staff dashboard
  useEffect(() => {
    if (userData?.role === 'staff') {
      navigate('/staff/dashboard');
    }
  }, [userData, navigate]);

  useEffect(() => {
    if (userData?.role !== 'admin') return;
    const loadAlterations = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'alterations'));
        setAlterationsPending(
          snapshot.docs.filter((doc) => {
            const status = (doc.data().status || '').toLowerCase();
            return status !== 'completed' && status !== 'delivered' && status !== 'cancelled';
          }).length
        );
      } catch (err) {
        console.error('Error loading alterations:', err);
      }
    };
    loadAlterations();
  }, [userData]);

  if (!userData) {
    return <LoadingSpinner type="page" />;
  }

  if (userData.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
            <p className="text-gray-600 text-center">
              You don't have permission to access the admin dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner type="page" />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="text-red-600 mb-4">Error loading dashboard data</div>
            <p className="text-gray-600 text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Every card here is something the admin acts on, and clicking it goes straight there.
  const actionCards = [
    {
      title: 'To Collect',
      value: formatCurrency(collections.outstanding),
      description: `${collections.debtors} customer${collections.debtors === 1 ? '' : 's'} owing`,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      onClick: () => navigate('/customers'),
    },
    {
      title: 'Pending Bills',
      value: collections.bills,
      description: 'Unpaid or part-paid',
      icon: Receipt,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      onClick: () => navigate('/billing', { state: { filterStatus: 'unpaid' } }),
    },
    {
      title: 'Orders in Progress',
      value: (stats.pendingOrders || 0) + (stats.activeOrders || 0),
      description: `${stats.pendingOrders || 0} pending · ${stats.activeOrders || 0} active`,
      icon: Truck,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      onClick: () => navigate('/orders'),
    },
    {
      title: "Today's Appointments",
      value: stats.todaysAppointments || 0,
      description: 'Scheduled for today',
      icon: Calendar,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      onClick: () => navigate('/appointments'),
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockItems || 0,
      description: 'Need reordering',
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      onClick: () => navigate('/inventory'),
    },
    {
      title: 'Open Alterations',
      value: alterationsPending,
      description: 'Not yet completed',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      onClick: () => navigate('/alterations'),
    },
  ];

  return (
    <div className="mobile-page-layout">
      <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
        {/* Welcome header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 p-5 text-white sm:p-6">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white opacity-10" />
          <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white opacity-10" />
          <div className="relative z-10">
            <h1 className="mb-1 text-2xl font-bold sm:text-3xl">
              Welcome back, {userData?.name}!
            </h1>
            <p className="text-sm text-white/90 sm:text-base">
              {collections.outstanding > 0
                ? `${formatCurrency(collections.outstanding)} is waiting to be collected from ${collections.debtors} customer${collections.debtors === 1 ? '' : 's'}.`
                : 'Everything is collected — nothing outstanding right now.'}
            </p>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
          {actionCards.map((card) => (
            <Card
              key={card.title}
              className="group cursor-pointer border-0 shadow-md transition-all duration-200 hover:shadow-lg"
              onClick={card.onClick}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="min-w-0 text-xs font-medium leading-snug text-gray-600 dark:text-gray-400 sm:text-sm">
                  {card.title}
                </CardTitle>
                <div className={`shrink-0 rounded-lg p-2 ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="break-words text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
                  {card.value}
                </div>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* The two lists the admin works from */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
          <PendingPaymentsPanel onLoaded={setCollections} />
          <PendingBillsPanel />
        </div>

        {/* Money snapshot */}
        <IncomeExpensesCard onClick={() => navigate('/income-expenses')} />
      </div>
    </div>
  );
};

export default AdminDashboard;
