import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from '@/pages/AdminDashboard';
import StaffDashboard from '@/pages/StaffDashboard';

const DashboardRouter = () => {
  const { userData } = useAuth();

  if (userData?.role === 'staff') {
    return <StaffDashboard />;
  }

  return <AdminDashboard />;
};

export default DashboardRouter;
