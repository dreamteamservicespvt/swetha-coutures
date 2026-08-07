import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  MessageSquare,
  IndianRupee,
  Loader2,
  ArrowRight,
  Receipt,
} from 'lucide-react';
import { fetchCollectionCached } from '@/utils/firestoreCache';
import { useNavigate } from 'react-router-dom';
import { formatBillDate, formatCurrency } from '@/utils/billingUtils';
import { formatBilledDate, formatPendingSince } from '@/utils/customerCalculations';
import CustomerWhatsAppModal from '@/components/CustomerWhatsAppModal';

interface PendingBill {
  id: string;
  billId: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  date: Date;
  customerName: string;
  customerPhone: string;
}

interface DebtorRow {
  key: string;
  name: string;
  phone: string;
  outstanding: number;
  bills: PendingBill[];
  oldest: Date;
  daysPending: number;
}

interface PendingPaymentsPanelProps {
  /** How many debtors to show before the "view all" link. */
  limit?: number;
  onLoaded?: (summary: { outstanding: number; debtors: number; bills: number }) => void;
}

/**
 * The collections queue: who owes money, oldest debt first.
 *
 * Grouped by customer (matched on phone, falling back to name) because a person with three
 * unpaid bills is one phone call, not three. Bills are read straight from the `bills`
 * collection rather than the customer docs so a bill raised for a walk-in who was never
 * saved as a customer still shows up.
 */
const PendingPaymentsPanel: React.FC<PendingPaymentsPanelProps> = ({ limit = 6, onLoaded }) => {
  const navigate = useNavigate();
  const [bills, setBills] = useState<PendingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [waCustomer, setWaCustomer] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const billDocs = await fetchCollectionCached('bills');
        const pending: PendingBill[] = [];
        billDocs.forEach((docSnap) => {
          const data = docSnap.data;
          const balance = Math.max(0, (data.totalAmount || 0) - (data.paidAmount || 0));
          if (balance <= 0.5) return;
          pending.push({
            id: docSnap.id,
            billId: data.billId || docSnap.id,
            totalAmount: data.totalAmount || 0,
            paidAmount: data.paidAmount || 0,
            balance,
            date: formatBillDate(data.date || data.createdAt),
            customerName: data.customerName || 'Unknown customer',
            customerPhone: data.customerPhone || '',
          });
        });
        if (!cancelled) setBills(pending);
      } catch (error) {
        console.error('Error loading pending payments:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const debtors = useMemo<DebtorRow[]>(() => {
    const map = new Map<string, DebtorRow>();
    bills.forEach((bill) => {
      const key = bill.customerPhone || bill.customerName;
      const row =
        map.get(key) ||
        ({
          key,
          name: bill.customerName,
          phone: bill.customerPhone,
          outstanding: 0,
          bills: [],
          oldest: bill.date,
          daysPending: 0,
        } as DebtorRow);
      row.outstanding += bill.balance;
      row.bills.push(bill);
      if (bill.date < row.oldest) row.oldest = bill.date;
      map.set(key, row);
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        bills: [...row.bills].sort((a, b) => a.date.getTime() - b.date.getTime()),
        daysPending: Math.max(
          0,
          Math.floor((Date.now() - row.oldest.getTime()) / (1000 * 60 * 60 * 24))
        ),
      }))
      .sort((a, b) => a.oldest.getTime() - b.oldest.getTime());
  }, [bills]);

  const totalOutstanding = debtors.reduce((sum, row) => sum + row.outstanding, 0);

  useEffect(() => {
    if (loading) return;
    onLoaded?.({
      outstanding: totalOutstanding,
      debtors: debtors.length,
      bills: bills.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, totalOutstanding, debtors.length, bills.length]);

  const visible = showAll ? debtors : debtors.slice(0, limit);

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                Payments to Collect
              </CardTitle>
              <CardDescription className="mt-1">
                Oldest pending first — chase these customers first
              </CardDescription>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xl sm:text-2xl font-bold text-red-600">
                {formatCurrency(totalOutstanding)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {debtors.length} customer{debtors.length === 1 ? '' : 's'} · {bills.length} bill
                {bills.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading pending payments…
            </div>
          ) : debtors.length === 0 ? (
            <div className="py-10 text-center">
              <IndianRupee className="mx-auto mb-3 h-10 w-10 text-green-500" />
              <p className="font-medium text-gray-800 dark:text-gray-200">Everything is collected</p>
              <p className="text-sm text-gray-500">No customer has a pending balance right now.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700 dark:hover:bg-gray-800/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {row.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          row.daysPending >= 30
                            ? 'border-red-300 text-red-700 dark:text-red-300'
                            : 'border-amber-300 text-amber-700 dark:text-amber-300'
                        }
                      >
                        pending {formatPendingSince(row.daysPending)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Billed {formatBilledDate(row.oldest)} · {row.phone || 'No phone'}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {row.bills.map((bill) => bill.billId).join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="text-lg font-bold text-red-600">
                      {formatCurrency(row.outstanding)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                      disabled={!row.phone}
                      onClick={() =>
                        setWaCustomer({
                          id: row.key,
                          name: row.name,
                          phone: row.phone,
                          customerType: 'regular',
                          outstandingBalance: row.outstanding,
                          daysPending: row.daysPending,
                          pendingBills: row.bills.map((bill) => ({
                            id: bill.id,
                            billId: bill.billId,
                            balance: bill.balance,
                            totalAmount: bill.totalAmount,
                            paidAmount: bill.paidAmount,
                            date: bill.date,
                          })),
                        })
                      }
                    >
                      <MessageSquare className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Remind</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/billing/${row.bills[0].id}`)}
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {debtors.length > limit && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowAll((open) => !open)}
                >
                  {showAll ? 'Show less' : `Show all ${debtors.length} customers`}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {waCustomer && (
        <CustomerWhatsAppModal
          customer={waCustomer}
          isOpen={!!waCustomer}
          onClose={() => setWaCustomer(null)}
        />
      )}
    </>
  );
};

export default PendingPaymentsPanel;
