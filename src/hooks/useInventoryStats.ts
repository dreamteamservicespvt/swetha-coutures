
import { useState, useEffect } from 'react';
import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CategoryStats {
  category: string;
  count: number;
}

interface TypeStats {
  type: string;
  count: number;
}

interface MostlyUsedData {
  categories: CategoryStats[];
  types: TypeStats[];
  loading: boolean;
  error: string | null;
}

export const useInventoryStats = (): MostlyUsedData => {
  const [data, setData] = useState<MostlyUsedData>({
    categories: [],
    types: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }));

        // Get all orders to calculate usage stats
        const ordersQuery = query(collection(db, 'orders'));
        const ordersSnapshot = await getDocs(ordersQuery);
        
        const categoryCount: { [key: string]: number } = {};
        const typeCount: { [key: string]: number } = {};

        ordersSnapshot.docs.forEach(doc => {
          const order = doc.data();
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              if (item.category) {
                categoryCount[item.category] = (categoryCount[item.category] || 0) + (item.quantity || 1);
              }
              if (item.type) {
                typeCount[item.type] = (typeCount[item.type] || 0) + (item.quantity || 1);
              }
            });
          }
          
          // Also count dress type as a type
          if (order.dressType) {
            typeCount[order.dressType] = (typeCount[order.dressType] || 0) + 1;
          }
        });

        // Convert to arrays and sort by count
        const categories = Object.entries(categoryCount)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const types = Object.entries(typeCount)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setData({
          categories,
          types,
          loading: false,
          error: null
        });

      } catch (error) {
        console.error('Error fetching inventory stats:', error);
        setData(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load usage statistics'
        }));
      }
    };

    fetchStats();
  }, []);

  return data;
};
