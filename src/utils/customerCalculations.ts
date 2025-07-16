import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface CustomerStats {
  totalOrders: number;
  totalBills: number;
  totalSpent: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  lastOrderDate?: string;
  outstandingBalance: number;
}

export const calculateCustomerStats = async (customerId: string, customerName: string, customerPhone: string): Promise<CustomerStats> => {
  try {
    const stats: CustomerStats = {
      totalOrders: 0,
      totalBills: 0,
      totalSpent: 0,
      paymentStatus: 'unpaid',
      outstandingBalance: 0
    };

    // Fetch customer's orders
    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerId', '==', customerId)
    );
    const ordersSnapshot = await getDocs(ordersQuery);
    stats.totalOrders = ordersSnapshot.size;

    // Get the most recent order date
    if (ordersSnapshot.size > 0) {
      const ordersWithDates = ordersSnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .filter((order: any) => order.orderDate || order.createdAt)
        .sort((a: any, b: any) => {
          const dateA = a.orderDate ? new Date(a.orderDate) : (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt));
          const dateB = b.orderDate ? new Date(b.orderDate) : (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt));
          return dateB.getTime() - dateA.getTime();
        });
      
      if (ordersWithDates.length > 0) {
        const lastOrder = ordersWithDates[0] as any;
        const lastOrderDate = lastOrder.orderDate ? new Date(lastOrder.orderDate) : (lastOrder.createdAt?.toDate ? lastOrder.createdAt.toDate() : new Date(lastOrder.createdAt));
        stats.lastOrderDate = lastOrderDate.toLocaleDateString('en-IN');
      }
    }

    // Fetch customer's bills - try multiple approaches for better matching
    let billsQuery;
    let billsSnapshot;
    
    // First try by customerId
    billsQuery = query(
      collection(db, 'bills'),
      where('customerId', '==', customerId)
    );
    billsSnapshot = await getDocs(billsQuery);
    
    // If no bills found by customerId, try by customerName
    if (billsSnapshot.empty && customerName) {
      billsQuery = query(
        collection(db, 'bills'),
        where('customerName', '==', customerName)
      );
      billsSnapshot = await getDocs(billsQuery);
    }
    
    // If still no bills found, try by customerPhone
    if (billsSnapshot.empty && customerPhone) {
      billsQuery = query(
        collection(db, 'bills'),
        where('customerPhone', '==', customerPhone)
      );
      billsSnapshot = await getDocs(billsQuery);
    }

    const bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    stats.totalBills = bills.length;

    // Calculate total spent and outstanding balance
    let totalSpent = 0;
    let outstandingBalance = 0;
    
    bills.forEach((bill: any) => {
      totalSpent += bill.totalAmount || 0;
      outstandingBalance += bill.balance || 0;
    });

    stats.totalSpent = totalSpent;
    stats.outstandingBalance = outstandingBalance;

    // Determine payment status
    if (outstandingBalance === 0 && totalSpent > 0) {
      stats.paymentStatus = 'paid';
    } else if (outstandingBalance > 0 && outstandingBalance < totalSpent) {
      stats.paymentStatus = 'partial';
    } else {
      stats.paymentStatus = 'unpaid';
    }

    return stats;
  } catch (error) {
    console.error('Error calculating customer stats:', error);
    return {
      totalOrders: 0,
      totalBills: 0,
      totalSpent: 0,
      paymentStatus: 'unpaid',
      outstandingBalance: 0
    };
  }
};

export const enrichCustomersWithStats = async (customers: any[]): Promise<any[]> => {
  const enrichedCustomers = await Promise.all(
    customers.map(async (customer) => {
      const stats = await calculateCustomerStats(customer.id, customer.name, customer.phone);
      return {
        ...customer,
        totalOrders: stats.totalOrders,
        totalBills: stats.totalBills,
        totalSpent: stats.totalSpent,
        paymentStatus: stats.paymentStatus,
        lastOrderDate: stats.lastOrderDate,
        outstandingBalance: stats.outstandingBalance
      };
    })
  );

  return enrichedCustomers;
};
