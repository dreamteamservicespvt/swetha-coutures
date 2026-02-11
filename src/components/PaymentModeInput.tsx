import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/billingUtils';
import { CreditCard, Banknote, ArrowLeftRight, Plus, Trash2 } from 'lucide-react';

export interface PaymentRecord {
  id: string;
  amount: number;
  type: 'cash' | 'online' | 'split';
  cashAmount?: number;
  onlineAmount?: number;
  paymentDate: Date | any; // Allow both Date and Firebase Timestamp
  notes?: string;
}

interface PaymentModeInputProps {
  totalAmount: number;
  currentPaidAmount: number;
  onPaymentChange: (
    paidAmount: number, 
    paymentRecords: PaymentRecord[],
    totalCash: number,
    totalOnline: number
  ) => void;
  initialPaymentRecords?: PaymentRecord[];
  disabled?: boolean;
}

const PaymentModeInput: React.FC<PaymentModeInputProps> = ({
  totalAmount,
  currentPaidAmount,
  onPaymentChange,
  initialPaymentRecords = [],
  disabled = false
}) => {
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>(initialPaymentRecords);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentType, setNewPaymentType] = useState<'cash' | 'online' | 'split'>('cash');
  const [newCashAmount, setNewCashAmount] = useState('');
  const [newOnlineAmount, setNewOnlineAmount] = useState('');
  const [newPaymentNotes, setNewPaymentNotes] = useState('');

  // Initialize payment records when initialPaymentRecords changes (for edit mode)
  useEffect(() => {
    if (initialPaymentRecords.length > 0) {
      // Convert any Firebase timestamps to dates properly
      const processedRecords = initialPaymentRecords.map(record => {
        let processedDate: Date;
        
        try {
          if (record.paymentDate instanceof Date) {
            processedDate = record.paymentDate;
          } else if (record.paymentDate && typeof record.paymentDate === 'object' && 'toDate' in record.paymentDate) {
            // Firebase Timestamp
            processedDate = record.paymentDate.toDate();
          } else if (record.paymentDate) {
            // String or other format
            processedDate = new Date(record.paymentDate);
          } else {
            processedDate = new Date();
          }
        } catch (error) {
          console.error('Error processing payment date:', error);
          processedDate = new Date();
        }
        
        return {
          ...record,
          paymentDate: processedDate
        };
      });
      setPaymentRecords(processedRecords);
    }
  }, [JSON.stringify(initialPaymentRecords)]); // Use JSON.stringify for deep comparison

  // Calculate totals
  const totalPaid = paymentRecords.reduce((sum, record) => sum + record.amount, 0);
  const totalCashReceived = paymentRecords.reduce((sum, record) => {
    if (record.type === 'cash') return sum + record.amount;
    if (record.type === 'split') return sum + (record.cashAmount || 0);
    return sum;
  }, 0);
  const totalOnlineReceived = paymentRecords.reduce((sum, record) => {
    if (record.type === 'online') return sum + record.amount;
    if (record.type === 'split') return sum + (record.onlineAmount || 0);
    return sum;
  }, 0);

  useEffect(() => {
    onPaymentChange(totalPaid, paymentRecords, totalCashReceived, totalOnlineReceived);
  }, [paymentRecords, totalPaid, totalCashReceived, totalOnlineReceived, onPaymentChange]);

  const addPayment = () => {
    if (!newPaymentAmount && newPaymentType !== 'split') return;
    
    let amount = 0;
    let cashAmount = 0;
    let onlineAmount = 0;

    if (newPaymentType === 'split') {
      cashAmount = parseFloat(newCashAmount) || 0;
      onlineAmount = parseFloat(newOnlineAmount) || 0;
      amount = cashAmount + onlineAmount;
    } else {
      amount = parseFloat(newPaymentAmount) || 0;
    }

    if (amount <= 0) return;

    const newRecord: PaymentRecord = {
      id: Date.now().toString(),
      amount,
      type: newPaymentType,
      ...(newPaymentType === 'split' && { cashAmount, onlineAmount }),
      paymentDate: new Date(),
      notes: newPaymentNotes || undefined
    };

    setPaymentRecords([...paymentRecords, newRecord]);
    
    // Reset form
    setNewPaymentAmount('');
    setNewCashAmount('');
    setNewOnlineAmount('');
    setNewPaymentNotes('');
  };

  const removePayment = (id: string) => {
    setPaymentRecords(paymentRecords.filter(record => record.id !== id));
  };

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'online': return <CreditCard className="h-4 w-4" />;
      case 'split': return <ArrowLeftRight className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  const getPaymentColor = (type: string) => {
    switch (type) {
      case 'cash': return 'bg-green-100 text-green-800';
      case 'online': return 'bg-blue-100 text-blue-800';
      case 'split': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Paid</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">Balance</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalAmount - totalPaid)}</p>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Cash Received</span>
            </div>
            <span className="font-bold text-green-700">{formatCurrency(totalCashReceived)}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Online Received</span>
            </div>
            <span className="font-bold text-blue-700">{formatCurrency(totalOnlineReceived)}</span>
          </div>
        </div>

        {/* Add New Payment */}
        {!disabled && (
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Add Payment</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="paymentType">Payment Type</Label>
                <Select value={newPaymentType} onValueChange={(value: 'cash' | 'online' | 'split') => setNewPaymentType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="split">Split (Cash + Online)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newPaymentType === 'split' ? (
                <>
                  <div>
                    <Label htmlFor="cashAmount">Cash Amount</Label>
                    <NumberInput
                      id="cashAmount"
                      value={newCashAmount}
                      onValueChange={(value) => setNewCashAmount(value)}
                      placeholder="0.00"
                      min={0}
                      step={0.01}
                      allowEmpty={true}
                      emptyValue={null}
                    />
                  </div>
                  <div>
                    <Label htmlFor="onlineAmount">Online Amount</Label>
                    <NumberInput
                      id="onlineAmount"
                      value={newOnlineAmount}
                      onValueChange={(value) => setNewOnlineAmount(value)}
                      placeholder="0.00"
                      min={0}
                      step={0.01}
                      allowEmpty={true}
                      emptyValue={null}
                    />
                  </div>
                </>
              ) : (
                <div className="md:col-span-2">
                  <Label htmlFor="paymentAmount">Amount</Label>
                  <NumberInput
                    id="paymentAmount"
                    value={newPaymentAmount}
                    onValueChange={(value) => setNewPaymentAmount(value)}
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    allowEmpty={true}
                    emptyValue={null}
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="paymentNotes">Notes (Optional)</Label>
              <Input
                id="paymentNotes"
                value={newPaymentNotes}
                onChange={(e) => setNewPaymentNotes(e.target.value)}
                placeholder="Payment reference, transaction ID, etc."
              />
            </div>

            <Button type="button" onClick={addPayment} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          </div>
        )}

        {/* Payment History */}
        {paymentRecords.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Payment History</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {paymentRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg bg-white dark:bg-gray-900">
                  <div className="flex items-center gap-3">
                    <Badge className={getPaymentColor(record.type)}>
                      <div className="flex items-center gap-1">
                        {getPaymentIcon(record.type)}
                        {record.type === 'split' 
                          ? `Split (₹${record.cashAmount} + ₹${record.onlineAmount})`
                          : record.type.charAt(0).toUpperCase() + record.type.slice(1)
                        }
                      </div>
                    </Badge>
                    <div>
                      <p className="font-medium">{formatCurrency(record.amount)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {record.paymentDate instanceof Date 
                          ? record.paymentDate.toLocaleDateString()
                          : new Date(record.paymentDate).toLocaleDateString()
                        }
                      </p>
                      {record.notes && (
                        <p className="text-xs text-gray-600 mt-1">{record.notes}</p>
                      )}
                    </div>
                  </div>
                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePayment(record.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentModeInput;
