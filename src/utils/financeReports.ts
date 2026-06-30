import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type FinanceDateRange = { start: Timestamp; end: Timestamp } | null;

export interface FinanceCategory {
  name: string;
  total: number;
  count: number;
  entries: any[];
}

interface StaffMember {
  id: string;
  name: string;
  salaryAmount?: number;
  salaryMode?: 'monthly' | 'daily' | 'hourly';
  paidSalary?: number;
  bonus?: number;
  [key: string]: any;
}

/** Normalise the many date shapes used across the app (Timestamp | {seconds} | string | Date) to a JS Date. */
export function toJsDate(date: any): Date {
  if (!date) return new Date(0);
  if (typeof date?.toDate === 'function') return date.toDate();
  if (date && typeof date === 'object' && 'seconds' in date) return new Date(date.seconds * 1000);
  if (date instanceof Date) return date;
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

/**
 * Client-side date filter. Returns true when there is no range, otherwise whether the (normalised)
 * value falls inside it. This is what makes every finance figure consistent regardless of whether a
 * record's date was stored as a Firestore Timestamp or as a plain string.
 */
export function isInRange(value: any, dateRange: FinanceDateRange): boolean {
  if (!dateRange) return true;
  const d = toJsDate(value);
  if (isNaN(d.getTime()) || d.getTime() === 0) return false;
  return d >= dateRange.start.toDate() && d <= dateRange.end.toDate();
}

/** Monthly salary using the newer paid-salary + bonus model (falls back to the configured salary). */
export function calculateMonthlySalary(staff: StaffMember): number {
  const paidSalary = staff.paidSalary || 0;
  const bonus = staff.bonus || 0;
  const actualSalary = staff.salaryAmount || 0;
  if (paidSalary > 0 && bonus > 0) return paidSalary + bonus;
  if (paidSalary > 0) return paidSalary;
  return actualSalary;
}

/**
 * Aggregate income or expense data grouped by category, within an optional date range.
 *
 * Single source of truth shared by the summary cards, the Income/Expense tab totals, the Tracking
 * tab and the Accounts/CA export — so every finance figure agrees. All date filtering is done
 * client-side (see {@link isInRange}).
 */
export async function getCategoryData(
  type: 'income' | 'expense',
  dateRange: FinanceDateRange
): Promise<FinanceCategory[]> {
  const categoryTotals: { [key: string]: FinanceCategory } = {};

  const add = (category: string, entry: any) => {
    if (!categoryTotals[category]) {
      categoryTotals[category] = { name: category, total: 0, count: 0, entries: [] };
    }
    categoryTotals[category].total += entry.amount || 0;
    categoryTotals[category].count++;
    categoryTotals[category].entries.push(entry);
  };

  if (type === 'income') {
    // Legacy 'billing' collection (date field: createdAt)
    const billingSnapshot = await getDocs(collection(db, 'billing'));
    billingSnapshot.docs
      .filter((doc) => isInRange(doc.data().createdAt, dateRange))
      .forEach((doc) => {
        const data = doc.data();
        add('Sales & Billing (Legacy)', {
          id: doc.id,
          amount: data.totalAmount || 0,
          date: data.createdAt,
          customerName: data.customerName || 'Unknown Customer',
          type: 'billing',
        });
      });

    // New 'bills' collection (date field: date)
    const billsSnapshot = await getDocs(collection(db, 'bills'));
    billsSnapshot.docs
      .filter((doc) => isInRange(doc.data().date, dateRange))
      .forEach((doc) => {
        const data = doc.data();
        add('Sales & Billing', {
          id: doc.id,
          amount: data.totalAmount || 0,
          date: data.date,
          customerName: data.customerName || 'Unknown Customer',
          type: 'billing',
        });
      });

    // Custom income (date field: date)
    const incomeSnapshot = await getDocs(collection(db, 'income'));
    incomeSnapshot.docs
      .filter((doc) => isInRange(doc.data().date || doc.data().createdAt, dateRange))
      .forEach((doc) => {
        const data = doc.data();
        const category = data.category || data.sourceName || 'Other Income';
        add(category, {
          id: doc.id,
          amount: data.amount || 0,
          date: data.date || data.createdAt,
          notes: data.notes,
          sourceName: data.sourceName,
          type: 'custom',
        });
      });
  } else {
    // Inventory purchases (date field: broughtAt)
    const inventorySnapshot = await getDocs(collection(db, 'inventory'));
    inventorySnapshot.docs
      .filter((doc) => doc.data().cost && doc.data().broughtAt && isInRange(doc.data().broughtAt, dateRange))
      .forEach((doc) => {
        const data = doc.data();
        add('Materials & Inventory', {
          id: doc.id,
          amount: data.cost || 0,
          date: data.broughtAt,
          itemName: data.itemName || data.name || 'Unknown Item',
          supplier: data.supplier || 'Unknown Supplier',
          type: 'inventory',
        });
      });

    // Custom expenses (date field: date)
    const expensesSnapshot = await getDocs(collection(db, 'expenses'));
    expensesSnapshot.docs
      .filter((doc) => isInRange(doc.data().date || doc.data().createdAt, dateRange))
      .forEach((doc) => {
        const data = doc.data();
        const category = data.category || 'Other Expenses';
        add(category, {
          id: doc.id,
          amount: data.amount || 0,
          date: data.date || data.createdAt,
          notes: data.notes,
          category: data.category,
          expenseName: data.expenseName,
          type: 'custom',
        });
      });

    // Staff salaries
    try {
      const staffSnapshot = await getDocs(query(collection(db, 'staff')));
      const staffMembers = staffSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as StaffMember[];

      for (const staff of staffMembers) {
        const monthlySalaryAmount = calculateMonthlySalary(staff);
        if (!monthlySalaryAmount || monthlySalaryAmount <= 0) continue;

        let salaryAmount = 0;
        const salaryDate = dateRange?.end || Timestamp.now();

        if (staff.salaryMode === 'monthly') {
          if (dateRange) {
            const monthsInRange = new Set();
            let currentDate = new Date(dateRange.start.toDate());
            while (currentDate <= dateRange.end.toDate()) {
              monthsInRange.add(`${currentDate.getFullYear()}-${currentDate.getMonth()}`);
              currentDate.setMonth(currentDate.getMonth() + 1);
            }
            salaryAmount = monthlySalaryAmount * monthsInRange.size;
          } else {
            salaryAmount = monthlySalaryAmount;
          }
        } else {
          // daily / hourly — count confirmed attendance within range (client-side filtered)
          const attendanceSnapshot = await getDocs(
            query(
              collection(db, 'attendance'),
              where('staffId', '==', staff.id),
              where('status', '==', 'confirmed')
            )
          );
          const attDocs = attendanceSnapshot.docs.filter((d) => isInRange(d.data().date, dateRange));
          const attendanceCount = attDocs.length;

          if (staff.salaryMode === 'daily') {
            const workingDays = attendanceCount > 0 ? attendanceCount : dateRange ? 0 : 1;
            if (workingDays > 0) salaryAmount = monthlySalaryAmount * workingDays;
          } else if (staff.salaryMode === 'hourly') {
            let totalHours = 0;
            if (attendanceCount > 0) {
              attDocs.forEach((d) => {
                totalHours += d.data().hoursWorked || 8;
              });
            } else if (!dateRange) {
              totalHours = 8;
            }
            if (totalHours > 0) salaryAmount = monthlySalaryAmount * totalHours;
          }
        }

        if (salaryAmount > 0) {
          add('Staff Salaries', {
            id: `salary-${staff.id}-${salaryDate.toMillis()}`,
            amount: salaryAmount,
            date: salaryDate,
            staffName: staff.name || 'Unknown Staff',
            expenseName: `${staff.name} Salary`,
            notes: `${staff.salaryMode} salary for ${staff.name}`,
            type: 'salary',
          });
        }
      }
    } catch (error) {
      console.error('Error calculating staff salaries for breakdown:', error);
    }
  }

  return Object.values(categoryTotals).sort((a, b) => b.total - a.total);
}

/**
 * Total gross billing amount in the period: sum of bill totals from the new `bills` collection
 * plus the legacy `billing` collection (client-side date filtered).
 */
export async function getTotalBilling(dateRange: FinanceDateRange): Promise<number> {
  let total = 0;

  const billsSnapshot = await getDocs(collection(db, 'bills'));
  total += billsSnapshot.docs
    .filter((doc) => isInRange(doc.data().date, dateRange))
    .reduce((sum, doc) => sum + (doc.data().totalAmount || 0), 0);

  const billingSnapshot = await getDocs(collection(db, 'billing'));
  total += billingSnapshot.docs
    .filter((doc) => isInRange(doc.data().createdAt, dateRange))
    .reduce((sum, doc) => sum + (doc.data().totalAmount || 0), 0);

  return total;
}

/** Convenience summary used by the Income & Expenses headline cards — same figures as Tracking/Accounts. */
export async function getFinancialSummary(
  dateRange: FinanceDateRange
): Promise<{ totalIncome: number; totalExpenses: number; netProfit: number; totalBilling: number }> {
  const [incomeCats, expenseCats, totalBilling] = await Promise.all([
    getCategoryData('income', dateRange),
    getCategoryData('expense', dateRange),
    getTotalBilling(dateRange),
  ]);
  const totalIncome = incomeCats.reduce((s, c) => s + c.total, 0);
  const totalExpenses = expenseCats.reduce((s, c) => s + c.total, 0);
  return { totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses, totalBilling };
}
