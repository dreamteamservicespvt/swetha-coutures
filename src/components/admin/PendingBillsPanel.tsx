import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { fetchCollectionCached, invalidateCollection } from '@/utils/firestoreCache';
import { useNavigate } from 'react-router-dom';
import { Bill, formatBillDate, formatCurrency, formatDateForDisplay } from '@/utils/billingUtils';
import BillPaymentDialog from '@/components/BillPaymentDialog';

interface PendingBillsPanelProps {
  limit?: number;
}

/**
 * Bills still carrying a balance, oldest first, with the payment dialog one click away —
 * so recording a collection never requires leaving the dashboard.
 */
const PendingBillsPanel: React.FC<PendingBillsPanelProps> = ({ limit = 6 }) => {
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const billDocs = await fetchCollectionCached('bills');
        const pending = billDocs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data }) as Bill)
          .filter((bill) => (bill.totalAmount || 0) - (bill.paidAmount || 0) > 0.5)
          .sort(
            (a, b) =>
              formatBillDate(a.date).getTime() - formatBillDate(b.date).getTime()
          );
        if (!cancelled) setBills(pending);
      } catch (error) {
        console.error('Error loading pending bills:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const visible = showAll ? bills : bills.slice(0, limit);
  const totalDue = bills.reduce(
    (sum, bill) => sum + ((bill.totalAmount || 0) - (bill.paidAmount || 0)),
    0
  );

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Receipt className="h-5 w-5 shrink-0 text-purple-600" />
                Pending Bills
              </CardTitle>
              <CardDescription className="mt-1">
                Unpaid &amp; part-paid bills — record a payment without leaving this page
              </CardDescription>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xl sm:text-2xl font-bold text-red-600">
                {formatCurrency(totalDue)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {bills.length} bill{bills.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading bills…
            </div>
          ) : bills.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
              <p className="font-medium text-gray-800 dark:text-gray-200">No pending bills</p>
              <p className="text-sm text-gray-500">Every bill has been settled.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((bill) => {
                const balance = (bill.totalAmount || 0) - (bill.paidAmount || 0);
                const partial = (bill.paidAmount || 0) > 0;
                return (
                  <div
                    key={bill.id}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700 dark:hover:bg-gray-800/60"
                  >
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => navigate(`/billing/${bill.id}`)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {bill.billId}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            partial
                              ? 'border-yellow-300 text-yellow-700 dark:text-yellow-300'
                              : 'border-red-300 text-red-700 dark:text-red-300'
                          }
                        >
                          {partial ? 'Partial' : 'Unpaid'}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                        {bill.customerName} · {formatDateForDisplay(bill.date)} · billed{' '}
                        {formatCurrency(bill.totalAmount || 0)}
                        {partial ? `, paid ${formatCurrency(bill.paidAmount || 0)}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <span className="text-lg font-bold text-red-600">
                        {formatCurrency(balance)}
                      </span>
                      <Button size="sm" onClick={() => setPayBill(bill)}>
                        Record payment
                      </Button>
                    </div>
                  </div>
                );
              })}

              {bills.length > limit && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowAll((open) => !open)}
                >
                  {showAll ? 'Show less' : `Show all ${bills.length} bills`}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <BillPaymentDialog
        bill={payBill}
        open={!!payBill}
        onOpenChange={(open) => {
          if (!open) setPayBill(null);
        }}
        onSaved={() => {
          // A payment was just written — drop the cached bills so the reload sees it.
          invalidateCollection('bills');
          setReloadKey((key) => key + 1);
        }}
      />
    </>
  );
};

export default PendingBillsPanel;
