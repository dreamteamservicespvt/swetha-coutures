
import React from 'react';
import Expenses from './Expenses';

// This is a redirect component for admin expenses
// It uses the same Expenses component but with admin-only access
const AdminExpenses = () => {
  return <Expenses />;
};

export default AdminExpenses;
