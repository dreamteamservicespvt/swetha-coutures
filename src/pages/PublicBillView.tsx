import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, CreditCard, Smartphone, Shield, AlertCircle } from 'lucide-react';
import { getBillByShareToken, isValidShareToken } from '@/utils/billShareUtils';
import { Bill, formatCurrency, formatDateForDisplay, getBillStatusColor, generateUPILink } from '@/utils/billingUtils';
import { toast } from '@/hooks/use-toast';

const PublicBillView = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchBillByToken();
    } else {
      setError('Invalid or missing share link');
      setLoading(false);
    }
  }, [token]);

  const fetchBillByToken = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Validate token format
      if (!isValidShareToken(token)) {
        setError('Invalid share link format');
        setLoading(false);
        return;
      }
      
      // Fetch bill by token
      const billData = await getBillByShareToken(token);
      
      if (!billData) {
        setError('Bill not found or link has been revoked');
        setLoading(false);
        return;
      }
      
      setBill(billData);
    } catch (error) {
      console.error('Error fetching bill:', error);
      setError('Failed to load bill. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithUPI = async () => {
    if (!bill) return;
    
    try {
      const upiLink = await generateUPILink(
        bill.upiId || '',
        bill.customerName,
        bill.balance || 0,
        bill.billId,
        '', // orderName
        '', // madeFor
        bill.orderId || '',
        '' // deliveryDate
      );
      
      window.open(upiLink, '_blank');
      
      toast({
        title: "UPI Payment",
        description: "Opening UPI app for payment",
      });
    } catch (error) {
      console.error('Error generating UPI link:', error);
      toast({
        title: "Error",
        description: "Failed to open UPI payment",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <p className="text-gray-600">Loading your bill...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Bill Not Found</h2>
                <p className="text-gray-600 mb-4">
                  {error || 'The bill you are looking for could not be found.'}
                </p>
                <Button 
                  onClick={() => navigate('/')}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <Shield className="h-4 w-4 text-green-600" />
          <span>Secure View-Only Bill</span>
        </div>

        {/* Header */}
        <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl sm:text-3xl mb-2">
                  Bill #{bill.billId}
                </CardTitle>
                <p className="text-purple-100">
                  Swetha Couture's
                </p>
              </div>
              <Badge 
                className={`${getBillStatusColor(bill.status)} text-white border-0`}
              >
                {bill.status?.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Customer Details */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-semibold">{bill.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-semibold">{bill.customerPhone}</p>
              </div>
              {bill.customerEmail && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-semibold">{bill.customerEmail}</p>
                </div>
              )}
              {bill.customerAddress && (
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-semibold">{bill.customerAddress}</p>
                </div>
              )}
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Bill Date</p>
                <p className="font-semibold">{formatDateForDisplay(bill.date)}</p>
              </div>
              {bill.dueDate && (
                <div>
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className="font-semibold">{formatDateForDisplay(bill.dueDate)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Bill Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.items && bill.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formatCurrency(bill.subtotal || 0)}</span>
            </div>
            {bill.gstPercent > 0 && (
              <div className="flex justify-between text-sm">
                <span>GST ({bill.gstPercent}%):</span>
                <span>{formatCurrency(bill.gstAmount || 0)}</span>
              </div>
            )}
            {bill.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Discount:</span>
                <span className="text-green-600">-{formatCurrency(bill.discount || 0)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total Amount:</span>
              <span className="text-purple-600">{formatCurrency(bill.totalAmount || 0)}</span>
            </div>
            <div className="flex justify-between text-green-600 font-semibold">
              <span>Paid Amount:</span>
              <span>{formatCurrency(bill.paidAmount || 0)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Balance Due:</span>
              <span className={bill.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(bill.balance || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Action */}
        {bill.balance > 0 && bill.upiId && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <CreditCard className="h-5 w-5" />
                Make Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                You have a pending balance of <span className="font-bold">{formatCurrency(bill.balance)}</span>. 
                Pay now using UPI for instant confirmation.
              </p>
              
              <Button 
                onClick={handlePayWithUPI}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                size="lg"
              >
                <Smartphone className="h-5 w-5 mr-2" />
                Pay {formatCurrency(bill.balance)} with UPI
              </Button>
              
              {bill.qrCodeUrl && (
                <div className="text-center">
                  <Separator className="my-4" />
                  <p className="text-sm text-gray-600 mb-3">Or scan this QR code to pay:</p>
                  <div className="flex justify-center">
                    <img 
                      src={bill.qrCodeUrl} 
                      alt="Payment QR Code" 
                      className="w-48 h-48 border-2 border-gray-300 rounded-lg"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    UPI ID: {bill.upiId}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Paid Status */}
        {bill.balance === 0 && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-800">Fully Paid</h3>
                  <p className="text-sm text-green-700">Thank you for your payment!</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {bill.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{bill.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Bank Details (if needed) */}
        {bill.bankDetails && bill.balance > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Bank Transfer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Account Name</p>
                  <p className="font-semibold">{bill.bankDetails.accountName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Account Number</p>
                  <p className="font-semibold">{bill.bankDetails.accountNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">IFSC Code</p>
                  <p className="font-semibold">{bill.bankDetails.ifsc}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Bank Name</p>
                  <p className="font-semibold">{bill.bankDetails.bankName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pb-6">
          <p>This is a secure, view-only bill. For any queries, please contact Swetha Couture's.</p>
          <p className="mt-1">Thank you for your business! 💖</p>
        </div>
      </div>
    </div>
  );
};

export default PublicBillView;
