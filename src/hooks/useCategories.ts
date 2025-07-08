import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  createdAt: any;
  isDefault?: boolean;
}

export const useCategories = (type: 'income' | 'expense') => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // No default categories - all categories come from user data

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const categoriesQuery = query(
        collection(db, 'categories'),
        where('type', '==', type),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(categoriesQuery);
      const customCategories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];

      setCategories(customCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Set empty array if error occurs
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [type]);

  const refetchCategories = () => {
    fetchCategories();
  };

  return {
    categories,
    loading,
    refetchCategories
  };
};
