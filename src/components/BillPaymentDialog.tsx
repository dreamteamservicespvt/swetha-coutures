import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Banknote, CreditCard, ArrowLeftRight, Plus, Trash2, Loader2 } from 'lucide-react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { invalidateCollection } from '@/utils/firestoreCache';
import {
  Bill,
  PaymentRecord,
  formatCurrency,
  buildPaymentUpdate,
  getPaymentRecords,
  summarisePaymentRecords,
} from '@/utils/billingUtils';

interface BillPaymentDialogProps {
  bill: Bill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the amount box with the outstanding balance (used by "Mark as Paid"). */
  prefillBalance?: boolean;
  onSaved?: () => void;
}

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'object' && 'seconds' in value) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const typeIcon = (type: string) => {
  if (type === 'cash') return <Banknote className="h-3.5 w-3.5" />;
  if (type === 'split') return <ArrowLeftRight className="h-3.5 w-3.5" />;
  return <CreditCard className="h-3.5 w-3.5" />;
};

const typeColor = (type: string) => {
  if (type === 'cash') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  if (type === 'split') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
};

/**
 * The bill's Payment Tracking section, shrunk into a dialog.
 *
 * This is the *only* way payments are recorded from the billing list, so the list and the
 * bill form always show the same numbers. Adding ₹15,000 on top of an existing ₹10,000
 * appends a second record and the paid total becomes ₹25,000 — the old dialog overwrote
 * `paidAmount` with whatever was typed, which is why the balance only dropped by the last
 * amount entered.
 */
const BillPaymentDialog: React.FC<BillPaymentDialogProps> = ({
  bill,
  open,
  onOpenChange,
  prefillBalance = false,
  onSaved,
}) => {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [newAmount, setNewAmount] = useState<string>('');
  const [newType, setNewType] = useState<'cash' | 'online' | 'split'>('cash');
  const [newCash, setNewCash] = useState<string>('');
  const [newOnline, setNewOnline] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const totalAmount = bill?.totalAmount || 0;

  // Reload from the bill each time the dialog opens so it never shows stale records.
  useEffect(() => {
    if (!open || !bill) return;
    const existing = getPaymentRecords(bill).map((record) => ({
      ...record,
      paymentDate: toDate(record.paymentDate),
    }));
    setRecords(existing);
    const { totalPaid } = summarisePaymentRecords(existing);
    const outstanding = Math.max(0, totalAmount - totalPaid);
    setNewAmount(prefillBalance && outstanding > 0 ? String(outstanding) : '');
    setNewType('cash');
    setNewCash('');
    setNewOnline('');
    setNotes('');
  }, [open, bill?.id, prefillBalance, totalAmount]);

  const { totalPaid, totalCash, totalOnline } = useMemo(
    () => summarisePaymentRecords(records),
    [records]
  );
  const balance = Math.max(0, totalAmount - totalPaid);

  const pendingAmount =
    newType === 'split'
      ? (parseFloat(newCash) || 0) + (parseFloat(newOnline) || 0)
      : parseFloat(newAmount) || 0;

  const addPayment = () => {
    if (pendingAmount <= 0) {
      toast({
        title: 'Enter an amount',
        description: 'Payment amount must be greater than zero.',
        variant: 'destructive',
      });
      return;
    }
    if (pendingAmount > balance + 0.01) {
      toast({
        title: 'Amount too high',
        description: `Only ${formatCurrency(balance)} is outstanding on this bill.`,
        variant: 'destructive',
      });
      return;
    }

    const record: PaymentRecord = {
      id: `${Date.now()}`,
      amount: pendingAmount,
      type: newType,
      ...(newType === 'split'
        ? { cashAmount: parseFloat(newCash) || 0, onlineAmount: parseFloat(newOnline) || 0 }
        : {}),
      paymentDate: new Date(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    setRecords((prev) => [...prev, record]);
    setNewAmount('');
    setNewCash('');
    setNewOnline('');
    setNotes('');
  };

  const removePayment = (id: string) => {
    setRecords((prev) => prev.filter((record) => record.id !== id));
  };

  const handleSave = async () => {
    if (!bill) return;
    setSaving(true);
    try {
      // Firestore rejects JS Dates nested in arrays inconsistently across SDK versions —
      // store ISO strings, which formatBillDate/toDate both already understand.
      const serialisable = records.map((record) => ({
        ...record,
        paymentDate: toDate(record.paymentDate).toISOString(),
      }));

      await updateDoc(doc(db, 'bills', bill.id), {
        ...buildPaymentUpdate(totalAmount, serialisable),
        updatedAt: Timestamp.now(),
      });

      // Any cached copy of `bills` is now stale.
      invalidateCollection('bills');

      toast({
        title: 'Payment updated',
        description: `${bill.billId}: paid ${formatCurrency(totalPaid)}, balance ${formatCurrency(balance)}.`,
      });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error('Error saving payments:', error);
      toast({
        title: 'Update failed',
        description: 'Could not save the payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Tracking
          </DialogTitle>
          <DialogDescription>
            {bill.billId} — {bill.customerName}
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
          <div className="text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">Total</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(totalAmount)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">Paid</p>
            <p className="text-sm font-bold text-green-600">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">Balance</p>
            <p className="text-sm font-bold text-red-600">{formatCurrency(balance)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 dark:bg-green-900/20">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Banknote className="h-3.5 w-3.5 text-green-600" /> Cash
            </span>
            <span className="text-sm font-bold text-green-700 dark:text-green-400">
              {formatCurrency(totalCash)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <CreditCard className="h-3.5 w-3.5 text-blue-600" /> Online
            </span>
            <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
              {formatCurrency(totalOnline)}
            </span>
          </div>
        </div>

        {/* Add payment */}
        {balance > 0 ? (
          <div className="space-y-3 rounded-lg border p-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add Payment</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Payment Type</Label>
                <Select value={newType} onValueChange={(value: any) => setNewType(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="split">Split (Cash + Online)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newType === 'split' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Cash</Label>
                    <NumberInput
                      value={newCash}
                      onValueChange={setNewCash}
                      placeholder="0.00"
                      min={0}
                      step={0.01}
                      allowEmpty
                      emptyValue={null}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Online</Label>
                    <NumberInput
                      value={newOnline}
                      onValueChange={setNewOnline}
                      placeholder="0.00"
                      min={0}
                      step={0.01}
                      allowEmpty
                      emptyValue={null}
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Amount</Label>
                  <NumberInput
                    value={newAmount}
                    onValueChange={setNewAmount}
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    allowEmpty
                    emptyValue={null}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setNewType('cash');
                  setNewAmount(String(balance));
                }}
              >
                Full balance
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setNewType('cash');
                  setNewAmount(String(Math.round(balance / 2)));
                }}
              >
                Half
              </Button>
            </div>

            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Reference, transaction ID…"
                className="mt-1"
              />
            </div>

            <Button type="button" onClick={addPayment} className="w-full" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Payment {pendingAmount > 0 ? `(${formatCurrency(pendingAmount)})` : ''}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm font-medium text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
            This bill is fully paid.
          </div>
        )}

        {/* History */}
        {records.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Payment History ({records.length})
            </h4>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge className={`${typeColor(record.type)} shrink-0`}>
                      <span className="flex items-center gap-1 text-[11px]">
                        {typeIcon(record.type)}
                        {record.type === 'split'
                          ? `₹${record.cashAmount || 0} + ₹${record.onlineAmount || 0}`
                          : record.type.charAt(0).toUpperCase() + record.type.slice(1)}
                      </span>
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatCurrency(record.amount)}</p>
                      <p className="truncate text-[11px] text-gray-500">
                        {toDate(record.paymentDate).toLocaleDateString('en-IN')}
                        {record.notes ? ` · ${record.notes}` : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removePayment(record.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            Save Payments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BillPaymentDialog;
