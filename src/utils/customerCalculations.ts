import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatBillDate } from './billingUtils';
import { fetchDocsCached } from './firestoreCache';

/** One unpaid / part-paid bill, used to drive the collections queue and the reminder message. */
export interface PendingBill {
  /** Firestore doc id — needed to mint the public share link. */
  id: string;
  /** Human bill number, e.g. "Bill355". */
  billId: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  date: Date;
}

export interface CustomerStats {
  totalOrders: number;
  totalBills: number;
  totalSpent: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  lastOrderDate?: string;
  outstandingBalance: number;
  /** Every bill still carrying a balance, oldest first. */
  pendingBills: PendingBill[];
  /** Date of the oldest unpaid bill — the sort key for "collect from these first". */
  oldestPendingDate?: Date;
  /** Whole days since that oldest bill, shown as "pending 34 days". */
  daysPending: number;
}

/**
 * "1 year 2 months", "3 months", "12 days" — a duration a shop owner can read at a glance.
 *
 * "396 days" is technically precise and practically useless; the point of this figure is to
 * convey how badly overdue something is, so the two largest meaningful units are enough.
 */
export const formatPendingSince = (days: number): string => {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;

  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);

  if (years > 0) {
    const yearPart = `${years} year${years === 1 ? '' : 's'}`;
    return months > 0 ? `${yearPart} ${months} month${months === 1 ? '' : 's'}` : yearPart;
  }

  const totalMonths = Math.floor(days / 30);
  const remainingDays = days % 30;
  const monthPart = `${totalMonths} month${totalMonths === 1 ? '' : 's'}`;
  return remainingDays >= 7
    ? `${monthPart} ${remainingDays} day${remainingDays === 1 ? '' : 's'}`
    : monthPart;
};

/** Whole days between a date and now, never negative. */
export const daysSince = (date?: Date | null): number => {
  if (!date || isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
};

/** Short, unambiguous bill date — "07 Jul 2025". */
export const formatBilledDate = (date?: Date | null): string => {
  if (!date || isNaN(date.getTime()) || date.getFullYear() <= 1970) return 'No date';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const emptyStats = (): CustomerStats => ({
  totalOrders: 0,
  totalBills: 0,
  totalSpent: 0,
  paymentStatus: 'unpaid',
  outstandingBalance: 0,
  pendingBills: [],
  daysPending: 0,
});

export const calculateCustomerStats = async (
  customerId: string,
  customerName: string,
  customerPhone: string
): Promise<CustomerStats> => {
  try {
    const stats = emptyStats();

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
          const dateA = formatBillDate(a.orderDate || a.createdAt);
          const dateB = formatBillDate(b.orderDate || b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

      if (ordersWithDates.length > 0) {
        const lastOrder = ordersWithDates[0] as any;
        const lastOrderDate = formatBillDate(lastOrder.orderDate || lastOrder.createdAt);
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

    const bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    stats.totalBills = bills.length;

    let totalSpent = 0;
    let outstandingBalance = 0;
    const pendingBills: PendingBill[] = [];

    bills.forEach((bill: any) => {
      totalSpent += bill.totalAmount || 0;

      // Derive the balance rather than trusting the stored field — older bills were written
      // before `balance` was maintained consistently.
      const balance = Math.max(0, (bill.totalAmount || 0) - (bill.paidAmount || 0));
      if (balance > 0.5) {
        outstandingBalance += balance;
        pendingBills.push({
          id: bill.id,
          billId: bill.billId || bill.id,
          totalAmount: bill.totalAmount || 0,
          paidAmount: bill.paidAmount || 0,
          balance,
          date: formatBillDate(bill.date || bill.createdAt),
        });
      }
    });

    pendingBills.sort((a, b) => a.date.getTime() - b.date.getTime());

    stats.totalSpent = totalSpent;
    stats.outstandingBalance = outstandingBalance;
    stats.pendingBills = pendingBills;
    stats.oldestPendingDate = pendingBills[0]?.date;
    stats.daysPending = stats.oldestPendingDate
      ? Math.max(
          0,
          Math.floor((Date.now() - stats.oldestPendingDate.getTime()) / (1000 * 60 * 60 * 24))
        )
      : 0;

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
    return emptyStats();
  }
};

const normaliseName = (value?: string) => (value || '').trim().toLowerCase();
const normalisePhone = (value?: string) => (value || '').replace(/\D/g, '').slice(-10);

/**
 * Stats for every customer, in **two** collection reads.
 *
 * The previous version called {@link calculateCustomerStats} per customer, and that function
 * issues up to four Firestore queries each (orders, then bills by id / name / phone). With
 * ~130 customers that was 300-500 sequential round trips and a ~7 second wait before the page
 * showed anything. Here orders and bills are read once and indexed in memory by customerId,
 * name and phone, then matched with the same id → name → phone precedence as before, so the
 * numbers are identical — just produced in about a second.
 */
export const enrichCustomersWithStats = async (customers: any[]): Promise<any[]> => {
  const [orders, bills] = await Promise.all([
    fetchDocsCached<any>('orders'),
    fetchDocsCached<any>('bills'),
  ]);

  const ordersByCustomer = new Map<string, any[]>();
  orders.forEach((order) => {
    if (!order.customerId) return;
    const list = ordersByCustomer.get(order.customerId) || [];
    list.push(order);
    ordersByCustomer.set(order.customerId, list);
  });

  // Three indexes mirroring the original lookup order.
  const billsById = new Map<string, any[]>();
  const billsByName = new Map<string, any[]>();
  const billsByPhone = new Map<string, any[]>();
  const push = (map: Map<string, any[]>, key: string, bill: any) => {
    if (!key) return;
    const list = map.get(key) || [];
    list.push(bill);
    map.set(key, list);
  };
  bills.forEach((bill) => {
    push(billsById, bill.customerId, bill);
    push(billsByName, normaliseName(bill.customerName), bill);
    push(billsByPhone, normalisePhone(bill.customerPhone), bill);
  });

  return customers.map((customer) => {
    const customerOrders = ordersByCustomer.get(customer.id) || [];

    // Same precedence as the per-customer version: id, then name, then phone.
    const matchedBills =
      billsById.get(customer.id) ||
      billsByName.get(normaliseName(customer.name)) ||
      billsByPhone.get(normalisePhone(customer.phone)) ||
      [];

    let lastOrderDate: string | undefined;
    if (customerOrders.length > 0) {
      const newest = customerOrders
        .map((order) => formatBillDate(order.orderDate || order.createdAt))
        .filter((date) => !isNaN(date.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      if (newest) lastOrderDate = newest.toLocaleDateString('en-IN');
    }

    let totalSpent = 0;
    let outstandingBalance = 0;
    const pendingBills: PendingBill[] = [];

    matchedBills.forEach((bill: any) => {
      totalSpent += bill.totalAmount || 0;
      const balance = Math.max(0, (bill.totalAmount || 0) - (bill.paidAmount || 0));
      if (balance > 0.5) {
        outstandingBalance += balance;
        pendingBills.push({
          id: bill.id,
          billId: bill.billId || bill.id,
          totalAmount: bill.totalAmount || 0,
          paidAmount: bill.paidAmount || 0,
          balance,
          date: formatBillDate(bill.date || bill.createdAt),
        });
      }
    });

    pendingBills.sort((a, b) => a.date.getTime() - b.date.getTime());
    const oldestPendingDate = pendingBills[0]?.date;

    const paymentStatus: CustomerStats['paymentStatus'] =
      outstandingBalance === 0 && totalSpent > 0
        ? 'paid'
        : outstandingBalance > 0 && outstandingBalance < totalSpent
          ? 'partial'
          : 'unpaid';

    return {
      ...customer,
      totalOrders: customerOrders.length,
      totalBills: matchedBills.length,
      totalSpent,
      paymentStatus,
      lastOrderDate,
      outstandingBalance,
      pendingBills,
      oldestPendingDate,
      daysPending: daysSince(oldestPendingDate),
    };
  });
};
