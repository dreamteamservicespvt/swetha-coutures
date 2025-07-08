import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CategorySuggestion {
  name: string;
  frequency: number;
}

export const useCategorySuggestions = (type: 'income' | 'expense') => {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategorySuggestions = async () => {
    setLoading(true);
    try {
      const categoryMap = new Map<string, number>();

      if (type === 'income') {
        // Fetch from custom income entries
        const incomeQuery = query(
          collection(db, 'income'),
          orderBy('createdAt', 'desc')
        );
        const incomeSnapshot = await getDocs(incomeQuery);
        
        incomeSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.category) {
            const category = data.category.trim();
            categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
          }
        });

        // Also consider sourceName as potential category
        incomeSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.sourceName) {
            const sourceName = data.sourceName.trim();
            categoryMap.set(sourceName, (categoryMap.get(sourceName) || 0) + 1);
          }
        });

        // Add "Sales & Billing" for billing entries (static category)
        categoryMap.set('Sales & Billing', 1);
      } else {
        // Fetch from custom expense entries
        const expensesQuery = query(
          collection(db, 'expenses'),
          orderBy('createdAt', 'desc')
        );
        const expensesSnapshot = await getDocs(expensesQuery);
        
        expensesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.category) {
            const category = data.category.trim();
            categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
          }
        });

        // Also consider inventory categories for expenses
        const inventoryQuery = query(
          collection(db, 'inventory'),
          orderBy('broughtAt', 'desc')
        );
        const inventorySnapshot = await getDocs(inventoryQuery);
        
        inventorySnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.category) {
            const category = data.category.trim();
            categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
          }
        });
      }

      // Convert map to sorted array
      const suggestionsArray = Array.from(categoryMap.entries())
        .map(([name, frequency]) => ({ name, frequency }))
        .sort((a, b) => b.frequency - a.frequency); // Sort by frequency, highest first

      setSuggestions(suggestionsArray);
    } catch (error) {
      console.error('Error fetching category suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorySuggestions();
  }, [type]);

  const addCategorySuggestion = (categoryName: string) => {
    if (!categoryName.trim()) return;
    
    const existingIndex = suggestions.findIndex(s => s.name.toLowerCase() === categoryName.toLowerCase());
    if (existingIndex >= 0) {
      // Increment frequency
      const updated = [...suggestions];
      updated[existingIndex].frequency += 1;
      updated.sort((a, b) => b.frequency - a.frequency);
      setSuggestions(updated);
    } else {
      // Add new suggestion
      const newSuggestion = { name: categoryName.trim(), frequency: 1 };
      setSuggestions(prev => [newSuggestion, ...prev].sort((a, b) => b.frequency - a.frequency));
    }
  };

  return {
    suggestions,
    loading,
    addCategorySuggestion,
    refetch: fetchCategorySuggestions
  };
};
