import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Banknote, ArrowLeftRight } from 'lucide-react';

export interface PaymentBreakdown {
  type: 'cash' | 'online' | 'split';
  totalAmount: number;
  cashAmount?: number;
  onlineAmount?: number;
}

interface PaymentModeSelectorProps {
  totalAmount: number;
  onPaymentChange: (breakdown: PaymentBreakdown) => void;
  initialBreakdown?: PaymentBreakdown;
  title?: string;
  description?: string;
  disabled?: boolean;
}

const PaymentModeSelector: React.FC<PaymentModeSelectorProps> = ({
  totalAmount,
  onPaymentChange,
  initialBreakdown,
  title = "Payment Mode",
  description = "Specify how this amount was received/paid",
  disabled = false
}) => {
  const [paymentType, setPaymentType] = useState<'cash' | 'online' | 'split'>(
    initialBreakdown?.type || 'cash'
  );
  const [cashAmount, setCashAmount] = useState<number>(
    initialBreakdown?.cashAmount || (initialBreakdown?.type === 'cash' ? totalAmount : 0)
  );
  const [onlineAmount, setOnlineAmount] = useState<number>(
    initialBreakdown?.onlineAmount || (initialBreakdown?.type === 'online' ? totalAmount : 0)
  );

  // Update payment breakdown when values change
  React.useEffect(() => {
    let breakdown: PaymentBreakdown;
    
    if (paymentType === 'split') {
      breakdown = {
        type: 'split',
        totalAmount,
        cashAmount,
        onlineAmount
      };
    } else if (paymentType === 'cash') {
      breakdown = {
        type: 'cash',
        totalAmount,
        cashAmount: totalAmount,
        onlineAmount: 0
      };
    } else {
      breakdown = {
        type: 'online',
        totalAmount,
        cashAmount: 0,
        onlineAmount: totalAmount
      };
    }
    
    onPaymentChange(breakdown);
  }, [paymentType, cashAmount, onlineAmount, totalAmount, onPaymentChange]);

  // Update cash/online amounts when total amount changes
  React.useEffect(() => {
    if (paymentType === 'cash') {
      setCashAmount(totalAmount);
    } else if (paymentType === 'online') {
      setOnlineAmount(totalAmount);
    }
  }, [totalAmount, paymentType]);

  const handlePaymentTypeChange = (type: 'cash' | 'online' | 'split') => {
    setPaymentType(type);
    
    if (type === 'cash') {
      setCashAmount(totalAmount);
      setOnlineAmount(0);
    } else if (type === 'online') {
      setCashAmount(0);
      setOnlineAmount(totalAmount);
    } else {
      // For split, keep current values or distribute equally
      if (cashAmount + onlineAmount !== totalAmount) {
        const half = totalAmount / 2;
        setCashAmount(half);
        setOnlineAmount(half);
      }
    }
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
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          {getPaymentIcon(paymentType)}
          {title}
        </CardTitle>
        <p className="text-xs text-gray-600">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {/* Payment Type Selection */}
        <div>
          <Label htmlFor="paymentType" className="text-sm font-medium">Payment Mode</Label>
          <Select 
            value={paymentType} 
            onValueChange={handlePaymentTypeChange}
            disabled={disabled}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Cash</span>
                </div>
              </SelectItem>
              <SelectItem value="online">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Online (UPI/Card/Bank)</span>
                </div>
              </SelectItem>
              <SelectItem value="split">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">Split (Cash + Online)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payment Breakdown Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
            <span className="text-sm font-medium">Total Amount:</span>
            <Badge variant="outline" className="font-mono text-sm">
              ₹{totalAmount.toLocaleString()}
            </Badge>
          </div>

          {paymentType === 'split' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cashAmount" className="text-xs sm:text-sm font-medium">Cash Amount</Label>
                <NumberInput
                  id="cashAmount"
                  value={cashAmount}
                  onChange={(value) => setCashAmount(value || 0)}
                  placeholder="0.00"
                  min={0}
                  max={totalAmount}
                  step={0.01}
                  decimals={2}
                  allowEmpty={false}
                  emptyValue={0}
                  disabled={disabled}
                  className="text-sm mt-1"
                />
              </div>
              <div>
                <Label htmlFor="onlineAmount" className="text-xs sm:text-sm font-medium">Online Amount</Label>
                <NumberInput
                  id="onlineAmount"
                  value={onlineAmount}
                  onChange={(value) => setOnlineAmount(value || 0)}
                  placeholder="0.00"
                  min={0}
                  max={totalAmount}
                  step={0.01}
                  decimals={2}
                  allowEmpty={false}
                  emptyValue={0}
                  disabled={disabled}
                  className="text-sm mt-1"
                />
              </div>
            </div>
          )}

          {/* Payment Summary */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between p-2 bg-green-50 rounded text-xs sm:text-sm">
              <div className="flex items-center gap-1">
                <Banknote className="h-3 w-3 text-green-600" />
                <span>Cash</span>
              </div>
              <span className="font-mono font-medium text-green-700">
                ₹{(paymentType === 'cash' ? totalAmount : cashAmount).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded text-xs sm:text-sm">
              <div className="flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-blue-600" />
                <span>Online</span>
              </div>
              <span className="font-mono font-medium text-blue-700">
                ₹{(paymentType === 'online' ? totalAmount : onlineAmount).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Validation for split payments */}
          {paymentType === 'split' && cashAmount + onlineAmount !== totalAmount && (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
              <div className="flex items-start gap-1">
                <span className="flex-shrink-0">⚠️</span>
                <span>Cash + Online amounts should equal total amount (₹{totalAmount.toLocaleString()})</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentModeSelector;
