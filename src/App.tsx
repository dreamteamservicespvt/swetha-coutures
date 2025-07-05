import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Index from './pages/Index';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Staff from './pages/Staff';
import StaffDashboard from './pages/StaffDashboard';
import Appointments from './pages/Appointments';
import Alterations from './pages/Alterations';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import DashboardRouter from './components/DashboardRouter';
import AdminExpenses from './pages/AdminExpenses';
import Billing from './pages/Billing';
import BillDetails from './pages/BillDetails';
import NewBill from './pages/NewBill';
import IncomeExpenses from './pages/IncomeExpenses';
import ROIDashboard from './components/ROIDashboard';
import StaffOrdersView from './components/StaffOrdersView';
import StaffInventoryView from './components/StaffInventoryView';
import StaffAlterationsView from './components/StaffAlterationsView';
import { BusinessSettingsProvider } from '@/components/BusinessSettingsProvider';

function App() {
  return (
    <Router>
      <BusinessSettingsProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DashboardRouter />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <Expenses />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <Inventory />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <Orders />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <Customers />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <Staff />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/dashboard"
              element={
                <ProtectedRoute staffOnly>
                  <Layout>
                    <StaffDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/orders"
              element={
                <ProtectedRoute staffOnly>
                  <Layout>
                    <StaffOrdersView />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/alterations"
              element={
                <ProtectedRoute staffOnly>
                  <Layout>
                    <StaffAlterationsView />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <Appointments />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/alterations"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <Alterations />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/expenses"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <AdminExpenses />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <Billing />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/new"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <NewBill />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/new/:orderId"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <NewBill />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/:billId"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <BillDetails />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/new/:billId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewBill />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/:billId/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewBill />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/income-expenses"
              element={
                <ProtectedRoute>
                  <Layout>
                    <IncomeExpenses />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roi-analytics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ROIDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </BusinessSettingsProvider>
    </Router>
  );
}

export default App;
