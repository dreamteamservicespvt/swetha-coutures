import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Default categories
const defaultIncomeCategories = [
  'Sales & Billing',
  'Consulting',
  'Online Orders',
  'Rent Income',
  'Investment Returns',
  'Other Income'
];

const defaultExpenseCategories = [
  'Materials',
  'Equipment',
  'Utilities',
  'Transportation',
  'Marketing',
  'Staff Wages',
  'Rent',
  'Insurance',
  'Maintenance',
  'Office Supplies',
  'Food & Beverages',
  'Other'
];

export const initializeDefaultCategories = async () => {
  try {
    // Check if default categories already exist
    const incomeQuery = query(
      collection(db, 'categories'),
      where('type', '==', 'income'),
      where('isDefault', '==', true)
    );
    const incomeSnapshot = await getDocs(incomeQuery);

    const expenseQuery = query(
      collection(db, 'categories'),
      where('type', '==', 'expense'),
      where('isDefault', '==', true)
    );
    const expenseSnapshot = await getDocs(expenseQuery);

    // Add default income categories if they don't exist
    if (incomeSnapshot.empty) {
      const incomePromises = defaultIncomeCategories.map(name =>
        addDoc(collection(db, 'categories'), {
          name,
          type: 'income',
          isDefault: true,
          createdAt: new Date()
        })
      );
      await Promise.all(incomePromises);
      console.log('Default income categories initialized');
    }

    // Add default expense categories if they don't exist
    if (expenseSnapshot.empty) {
      const expensePromises = defaultExpenseCategories.map(name =>
        addDoc(collection(db, 'categories'), {
          name,
          type: 'expense',
          isDefault: true,
          createdAt: new Date()
        })
      );
      await Promise.all(expensePromises);
      console.log('Default expense categories initialized');
    }
  } catch (error) {
    console.error('Error initializing default categories:', error);
  }
};

export { defaultIncomeCategories, defaultExpenseCategories };
