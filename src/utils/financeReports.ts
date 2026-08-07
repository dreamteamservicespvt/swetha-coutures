import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getPaymentRecords } from '@/utils/billingUtils';
import { fetchCollectionCached } from '@/utils/firestoreCache';

/**
 * Whole-collection reads go through the shared burst cache. Several of these helpers run
 * together on one screen (summary cards + tab + chart), and each was independently pulling
 * every bill down the wire.
 */
const readAll = (name: string) => fetchCollectionCached(name);

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

/**
 * The pay rate for an employee, for the pay basis they are on.
 *
 * `salaryAmount` is authoritative — it is the single amount the Employees form writes.
 * `paidSalary` is a legacy field from an older three-field form; it is only consulted when
 * `salaryAmount` is missing, so records that predate the form change still produce a figure
 * instead of silently reading as ₹0.
 */
export function calculateMonthlySalary(staff: StaffMember): number {
  const rate = staff.salaryAmount || staff.paidSalary || 0;
  return rate + (staff.bonus || 0);
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
    // Legacy 'billing' collection — collected amount only, falling back to the bill total
    // for old records that predate payment tracking.
    const billingDocs = await readAll('billing');
    billingDocs
      .filter((doc) => isInRange(doc.data.createdAt, dateRange))
      .forEach((doc) => {
        const data = doc.data;
        const collected =
          data.paidAmount !== undefined && data.paidAmount !== null
            ? data.paidAmount
            : data.totalAmount || 0;
        if (!collected) return;
        add('Sales & Billing (Legacy)', {
          id: doc.id,
          amount: collected,
          date: data.createdAt,
          customerName: data.customerName || 'Unknown Customer',
          type: 'billing',
        });
      });

    // New 'bills' collection — one entry per *payment received*, dated when the money
    // actually came in. A ₹20,000 bill with ₹10,000 collected is ₹10,000 of income; the
    // remaining ₹10,000 appears in the period it is eventually collected in.
    const billDocs = await readAll('bills');
    billDocs.forEach((doc) => {
      const data = doc.data;
      const bill = { id: doc.id, ...data } as any;
      const records = getPaymentRecords(bill);
      if (records.length === 0) return;

      records.forEach((record, index) => {
        // Legacy paid amounts have no payment date of their own — fall back to the bill date.
        const paidOn = record.paymentDate || data.date || data.createdAt;
        if (!isInRange(paidOn, dateRange)) return;
        if (!record.amount) return;

        add('Sales & Billing', {
          id: `${doc.id}-${record.id || index}`,
          billDocId: doc.id,
          billNumber: data.billId || doc.id,
          amount: record.amount,
          date: paidOn,
          customerName: data.customerName || 'Unknown Customer',
          paymentMode: record.type,
          cashAmount: record.type === 'cash' ? record.amount : record.cashAmount || 0,
          onlineAmount: record.type === 'online' ? record.amount : record.onlineAmount || 0,
          billTotal: data.totalAmount || 0,
          billBalance: data.balance || 0,
          instalment: records.length > 1 ? `Payment ${index + 1} of ${records.length}` : undefined,
          notes: record.notes,
          type: 'billing',
        });
      });
    });

    // Custom income (date field: date)
    const incomeDocs = await readAll('income');
    incomeDocs
      .filter((doc) => isInRange(doc.data.date || doc.data.createdAt, dateRange))
      .forEach((doc) => {
        const data = doc.data;
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
    const inventoryDocs = await readAll('inventory');
    inventoryDocs
      .filter((doc) => doc.data.cost && doc.data.broughtAt && isInRange(doc.data.broughtAt, dateRange))
      .forEach((doc) => {
        const data = doc.data;
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
    const expenseDocs = await readAll('expenses');
    expenseDocs
      .filter((doc) => isInRange(doc.data.date || doc.data.createdAt, dateRange))
      .forEach((doc) => {
        const data = doc.data;
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
      const staffDocs = await readAll('staff');
      const staffMembers = staffDocs.map((doc) => ({ id: doc.id, ...doc.data })) as StaffMember[];

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
          // daily / hourly — count confirmed attendance within range. Read once and filter in
          // memory: this used to fire a Firestore query per employee, per call.
          const allAttendance = await readAll('attendance');
          const attDocs = allAttendance.filter(
            (d) =>
              d.data.staffId === staff.id &&
              d.data.status === 'confirmed' &&
              isInRange(d.data.date, dateRange)
          );
          const attendanceCount = attDocs.length;

          if (staff.salaryMode === 'daily') {
            const workingDays = attendanceCount > 0 ? attendanceCount : dateRange ? 0 : 1;
            if (workingDays > 0) salaryAmount = monthlySalaryAmount * workingDays;
          } else if (staff.salaryMode === 'hourly') {
            let totalHours = 0;
            if (attendanceCount > 0) {
              attDocs.forEach((d) => {
                totalHours += d.data.hoursWorked || 8;
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

  const [billDocs, billingDocs] = await Promise.all([readAll('bills'), readAll('billing')]);
  total += billDocs
    .filter((doc) => isInRange(doc.data.date, dateRange))
    .reduce((sum, doc) => sum + (doc.data.totalAmount || 0), 0);

  total += billingDocs
    .filter((doc) => isInRange(doc.data.createdAt, dateRange))
    .reduce((sum, doc) => sum + (doc.data.totalAmount || 0), 0);

  return total;
}

export interface MonthlyPoint {
  month: string;
  revenue: number;
  expenses: number;
}

/**
 * Collected income and expenses for each month of a year, in a single pass.
 *
 * Calling {@link getFinancialSummary} twelve times would re-scan every collection twelve
 * times over (and re-run the per-employee attendance queries with it), which was slow enough
 * to leave the Reports page stuck on its skeleton. Same rules as the rest of the finance
 * layer — income is money actually received, dated when it arrived.
 */
export async function getMonthlySeries(year: number): Promise<MonthlyPoint[]> {
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const points: MonthlyPoint[] = monthNames.map((month) => ({ month, revenue: 0, expenses: 0 }));

  const bucket = (value: any): number | null => {
    const date = toJsDate(value);
    if (!date || isNaN(date.getTime()) || date.getFullYear() !== year) return null;
    return date.getMonth();
  };

  const [bills, billing, income, expenses, inventory] = await Promise.all([
    readAll('bills'),
    readAll('billing'),
    readAll('income'),
    readAll('expenses'),
    readAll('inventory'),
  ]);

  bills.forEach((doc) => {
    const data = doc.data;
    getPaymentRecords({ id: doc.id, ...data } as any).forEach((record) => {
      const month = bucket(record.paymentDate || data.date || data.createdAt);
      if (month !== null) points[month].revenue += record.amount || 0;
    });
  });

  billing.forEach((doc) => {
    const data = doc.data;
    const collected =
      data.paidAmount !== undefined && data.paidAmount !== null ? data.paidAmount : data.totalAmount || 0;
    const month = bucket(data.createdAt);
    if (month !== null) points[month].revenue += collected || 0;
  });

  income.forEach((doc) => {
    const month = bucket(doc.data.date || doc.data.createdAt);
    if (month !== null) points[month].revenue += doc.data.amount || 0;
  });

  expenses.forEach((doc) => {
    const month = bucket(doc.data.date || doc.data.createdAt);
    if (month !== null) points[month].expenses += doc.data.amount || 0;
  });

  inventory.forEach((doc) => {
    if (!doc.data.cost || !doc.data.broughtAt) return;
    const month = bucket(doc.data.broughtAt);
    if (month !== null) points[month].expenses += doc.data.cost || 0;
  });

  return points;
}

/**
 * Money still owed to the business across all bills, regardless of when they were raised.
 * Deliberately not date-filtered: an unpaid bill from March is still outstanding today.
 */
export async function getOutstandingTotal(): Promise<{ amount: number; bills: number }> {
  const billDocs = await readAll('bills');
  let amount = 0;
  let bills = 0;
  billDocs.forEach((doc) => {
    const data = doc.data;
    const balance = (data.totalAmount || 0) - (data.paidAmount || 0);
    if (balance > 0.5) {
      amount += balance;
      bills += 1;
    }
  });
  return { amount, bills };
}

/** Convenience summary used by the Income & Expenses headline cards — same figures as Tracking/Accounts. */
export async function getFinancialSummary(
  dateRange: FinanceDateRange
): Promise<{
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  totalBilling: number;
  uncollected: number;
  incomeCategories: FinanceCategory[];
  expenseCategories: FinanceCategory[];
}> {
  const [incomeCats, expenseCats, totalBilling] = await Promise.all([
    getCategoryData('income', dateRange),
    getCategoryData('expense', dateRange),
    getTotalBilling(dateRange),
  ]);
  const totalIncome = incomeCats.reduce((s, c) => s + c.total, 0);
  const totalExpenses = expenseCats.reduce((s, c) => s + c.total, 0);
  // Billed-but-not-yet-collected within this period. Shown next to income so the gap
  // between "we invoiced X" and "we actually received Y" is never a surprise.
  const billingIncome = incomeCats
    .filter((c) => c.name.startsWith('Sales & Billing'))
    .reduce((s, c) => s + c.total, 0);
  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    totalBilling,
    uncollected: Math.max(0, totalBilling - billingIncome),
    // Handed back so callers that also want the breakdown do not repeat the whole pass.
    incomeCategories: incomeCats,
    expenseCategories: expenseCats,
  };
}
