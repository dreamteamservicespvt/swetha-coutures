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
import AdminExpenses from './pages/AdminExpenses';
import Billing from './pages/Billing';
import BillDetails from './pages/BillDetails';
import NewBill from './pages/NewBill';
import IncomeExpenses from './pages/IncomeExpenses';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <AdminDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Layout>
                  <AdminDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <Layout>
                  <Expenses />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <Layout>
                  <Inventory />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Layout>
                  <Orders />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <Layout>
                  <Customers />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute>
                <Layout>
                  <Staff />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <StaffDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/appointments"
            element={
              <ProtectedRoute>
                <Layout>
                  <Appointments />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/alterations"
            element={
              <ProtectedRoute>
                <Layout>
                  <Alterations />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Layout>
                  <Reports />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/expenses"
            element={
              <ProtectedRoute>
                <Layout>
                  <AdminExpenses />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <Layout>
                  <Billing />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <NewBill />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing/new/:orderId"
            element={
              <ProtectedRoute>
                <Layout>
                  <NewBill />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing/:billId"
            element={
              <ProtectedRoute>
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
