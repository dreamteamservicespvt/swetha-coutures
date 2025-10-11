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
import { ArrowLeft, CreditCard, Smartphone, Shield, AlertCircle, Download, Printer, Upload, X, Image as ImageIcon, Copy, Check } from 'lucide-react';
import { getBillByShareToken, isValidShareToken } from '@/utils/billShareUtils';
import { Bill, formatCurrency, formatDateForDisplay, getBillStatusColor, generateUPILink, downloadPDF, printBill } from '@/utils/billingUtils';
import { toast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PublicBillView = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [copiedUPI, setCopiedUPI] = useState(false);

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

  const handleDownloadPDF = async () => {
    if (!bill) return;
    setDownloading(true);
    try {
      await downloadPDF(bill);
      toast({
        title: "PDF Downloaded",
        description: `Bill ${bill.billId} downloaded successfully`,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download PDF",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintBill = async () => {
    if (!bill) return;
    try {
      await printBill(bill);
      toast({
        title: "Print Ready",
        description: `Bill ${bill.billId} is ready for printing`,
      });
    } catch (error) {
      console.error('Error printing bill:', error);
      toast({
        title: "Print Failed",
        description: "Failed to prepare bill for printing",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !bill) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setSelectedImageFile(file);
    setImagePreviewUrl(previewUrl);
    setShowUploadDialog(true);

    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleCancelUpload = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setShowUploadDialog(false);
  };

  const handleConfirmUpload = async () => {
    if (!selectedImageFile || !bill) return;

    // Check if Cloudinary is configured
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    if (!cloudName || cloudName === 'your-cloud-name') {
      toast({
        title: "Configuration Error",
        description: "Cloudinary is not configured. Please contact support.",
        variant: "destructive",
      });
      console.error('VITE_CLOUDINARY_CLOUD_NAME is not set in environment variables');
      setUploading(false);
      return;
    }

    setUploading(true);
    try {
      // Upload to Cloudinary
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'swetha';
      const formData = new FormData();
      formData.append('file', selectedImageFile);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'payment_screenshots');

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      console.log('Uploading to Cloudinary:', cloudinaryUrl);
      console.log('Using upload preset:', uploadPreset);

      const response = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Cloudinary error:', errorData);
        throw new Error(errorData?.error?.message || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      const screenshotUrl = data.secure_url;

      if (!screenshotUrl) {
        throw new Error('No secure URL returned from Cloudinary');
      }

      // Update bill in Firebase with screenshot URL
      await updateDoc(doc(db, 'bills', bill.id), {
        paymentScreenshot: screenshotUrl,
        paymentScreenshotUploadedAt: new Date(),
      });

      // Update local state
      setBill(prev => prev ? { ...prev, paymentScreenshot: screenshotUrl } : null);

      toast({
        title: "Screenshot Uploaded",
        description: "Payment screenshot uploaded successfully",
      });

      // Clean up
      handleCancelUpload();
    } catch (error) {
      console.error('Error uploading screenshot:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload payment screenshot';
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCopyUPI = async () => {
    if (!bill?.upiId) return;
    
    try {
      await navigator.clipboard.writeText(bill.upiId);
      setCopiedUPI(true);
      toast({
        title: "UPI ID Copied",
        description: "UPI ID has been copied to clipboard",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedUPI(false), 2000);
    } catch (error) {
      console.error('Error copying UPI ID:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy UPI ID",
        variant: "destructive",
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
                className={`${
                  bill.status === 'paid' ? 'bg-green-500' :
                  bill.status === 'partial' ? 'bg-yellow-500' :
                  'bg-red-500'
                } text-white border-0 font-semibold px-3 py-1`}
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
              <p className="text-sm text-gray-700 mb-4">
                You have a pending balance of <span className="font-bold">{formatCurrency(bill.balance)}</span>. 
                Pay using UPI for instant confirmation.
              </p>
              
              {/* Copyable UPI ID */}
              <div className="bg-white rounded-lg border-2 border-green-300 p-4">
                <p className="text-xs text-gray-600 mb-2 font-medium">UPI ID</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 rounded-md px-4 py-3 font-mono text-sm font-semibold text-gray-800 border border-gray-200">
                    {bill.upiId}
                  </div>
                  <Button
                    onClick={handleCopyUPI}
                    variant={copiedUPI ? "default" : "outline"}
                    size="lg"
                    className={copiedUPI ? "bg-green-600 hover:bg-green-700 text-white" : "border-green-600 text-green-600 hover:bg-green-50"}
                  >
                    {copiedUPI ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Copy this UPI ID to make payment from any UPI app
                </p>
              </div>
              
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
                    Scan with any UPI app to pay {formatCurrency(bill.balance)}
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

        {/* Customer Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                onClick={handleDownloadPDF}
                disabled={downloading}
                variant="outline"
                className="w-full"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>

              <Button
                onClick={handlePrintBill}
                variant="outline"
                className="w-full"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Bill
              </Button>

              <Button
                onClick={() => document.getElementById('payment-screenshot-input')?.click()}
                disabled={uploading}
                variant="outline"
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Payment Screenshot
              </Button>
              <Input
                id="payment-screenshot-input"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Show uploaded screenshot */}
            {bill.paymentScreenshot && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Payment Screenshot Uploaded</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowScreenshotModal(true)}
                    className="text-green-600 hover:text-green-700"
                  >
                    View
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Preview Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Preview Payment Screenshot</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {imagePreviewUrl && (
                <div className="relative bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300">
                  <img
                    src={imagePreviewUrl}
                    alt="Payment Screenshot Preview"
                    className="w-full h-auto max-h-96 object-contain rounded"
                  />
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button
                  onClick={handleCancelUpload}
                  variant="outline"
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => document.getElementById('payment-screenshot-input')?.click()}
                  variant="outline"
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Different Image
                </Button>
                <Button
                  onClick={handleConfirmUpload}
                  disabled={uploading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Confirm & Upload
                    </>
                  )}
                </Button>
              </div>
              
              <p className="text-xs text-gray-500 text-center">
                Make sure the payment details are clearly visible before uploading
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Screenshot Modal */}
        <Dialog open={showScreenshotModal} onOpenChange={setShowScreenshotModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Payment Screenshot</DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setShowScreenshotModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <img
                src={bill.paymentScreenshot}
                alt="Payment Screenshot"
                className="w-full h-auto max-h-[calc(90vh-100px)] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>

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
