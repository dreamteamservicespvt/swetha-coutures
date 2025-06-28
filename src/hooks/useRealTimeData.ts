
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const useRealTimeData = (collectionName: string, orderByField?: string) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!collectionName) {
      setLoading(false);
      setError('No collection name provided');
      return;
    }

    try {
      let q = collection(db, collectionName);
      
      if (orderByField) {
        q = query(q, orderBy(orderByField, 'desc')) as any;
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          try {
            const documents = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setData(documents || []);
            setLoading(false);
            setError(null);
          } catch (docError) {
            console.error(`Error processing ${collectionName} documents:`, docError);
            setData([]);
            setLoading(false);
            setError('Error processing data');
          }
        },
        (err) => {
          console.error(`Error fetching ${collectionName}:`, err);
          setError(err.message || 'Unknown error occurred');
          setLoading(false);
          setData([]);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error(`Error setting up listener for ${collectionName}:`, err);
      setError('Error setting up data listener');
      setLoading(false);
    }
  }, [collectionName, orderByField]);

  return { data: data || [], loading, error };
};

export const useRealTimeStats = () => {
  const { data: orders, loading: ordersLoading, error: ordersError } = useRealTimeData('orders', 'createdAt');
  const { data: customers, loading: customersLoading, error: customersError } = useRealTimeData('customers', 'createdAt');
  const { data: inventory, loading: inventoryLoading, error: inventoryError } = useRealTimeData('inventory');
  const { data: appointments, loading: appointmentsLoading, error: appointmentsError } = useRealTimeData('appointments', 'createdAt');

  const loading = ordersLoading || customersLoading || inventoryLoading || appointmentsLoading;
  const error = ordersError || customersError || inventoryError || appointmentsError;

  // Safe data access with fallbacks
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const safeAppointments = Array.isArray(appointments) ? appointments : [];

  const stats = {
    totalOrders: safeOrders.length,
    totalCustomers: safeCustomers.length,
    totalRevenue: safeOrders
      .filter(order => order?.status === 'delivered')
      .reduce((sum, order) => sum + (order?.totalAmount || 0), 0),
    lowStockItems: safeInventory.filter(item => 
      (item?.quantity || 0) < (item?.minStock || item?.reorderLevel || 10)
    ).length,
    todaysAppointments: safeAppointments.filter(apt => {
      if (!apt?.appointmentDate) return false;
      try {
        const today = new Date().toISOString().split('T')[0];
        const aptDate = apt.appointmentDate?.toDate?.()?.toISOString().split('T')[0] || 
                       new Date(apt.appointmentDate).toISOString().split('T')[0];
        return aptDate === today;
      } catch {
        return false;
      }
    }).length,
    activeOrders: safeOrders.filter(order => 
      ['received', 'in-progress'].includes(order?.status)
    ).length,
    pendingOrders: safeOrders.filter(order => order?.status === 'received').length,
    completedOrders: safeOrders.filter(order => 
      ['ready', 'delivered'].includes(order?.status)
    ).length,
    readyOrders: safeOrders.filter(order => order?.status === 'ready').length
  };

  return { 
    stats, 
    loading, 
    error,
    rawData: {
      orders: safeOrders,
      customers: safeCustomers,
      inventory: safeInventory,
      appointments: safeAppointments
    }
  };
};

// Hook for safe Firestore data fetching with error boundaries
export const useSafeFirestoreData = (collectionName: string, orderByField?: string) => {
  const { data, loading, error } = useRealTimeData(collectionName, orderByField);
  
  // Return safe data with loading and error handling
  if (loading) {
    return { 
      data: [], 
      loading: true, 
      error: null,
      isEmpty: false,
      isError: false 
    };
  }
  
  if (error) {
    return { 
      data: [], 
      loading: false, 
      error,
      isEmpty: false,
      isError: true 
    };
  }
  
  const safeData = Array.isArray(data) ? data : [];
  
  return { 
    data: safeData, 
    loading: false, 
    error: null,
    isEmpty: safeData.length === 0,
    isError: false 
  };
};
