import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBusinessSettings } from '@/components/BusinessSettingsProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Edit, Trash2, Download, MessageSquare, CreditCard, QrCode, Printer, Share2 } from 'lucide-react';
import { doc, getDoc, deleteDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bill, BillCreate, formatCurrency, calculateBillStatus, downloadPDF, printBill, formatBillDate, formatDateForDisplay, getBillStatusColor } from '@/utils/billingUtils';
import { toast } from '@/hooks/use-toast';
import BillWhatsAppAdvanced from '@/components/BillWhatsAppAdvanced';
import BillFormAdvanced from '@/components/BillFormAdvanced';
import { getOrCreateShareToken, generatePublicBillUrl, generateWhatsAppShareUrl } from '@/utils/billShareUtils';

const BillDetails = () => {
  const { billId } = useParams<{ billId: string }>();
  const navigate = useNavigate();
  const { settings: businessSettings } = useBusinessSettings();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (billId) {
      fetchBill();
    }
  }, [billId]);

  const fetchBill = async () => {
    if (!billId) return;
    
    try {
      setLoading(true);
      console.log('Fetching bill with ID or number:', billId);
      
      // Try to get the bill directly first (assuming billId might be the document ID)
      let billDoc = await getDoc(doc(db, 'bills', billId));
      
      // If bill not found by ID, try querying by billId (bill number) as fallback
      if (!billDoc.exists()) {
        console.log('Bill not found by document ID, trying to find by bill number');
        // Check if the passed ID is a UUID (document ID) or a bill number (BILL123456)
        const isBillNumber = typeof billId === 'string' && billId.startsWith('BILL');
        
        if (isBillNumber) {
          // Search by billId field
          const billsQuery = query(
            collection(db, 'bills'),
            where('billId', '==', billId)
          );
          
          const querySnapshot = await getDocs(billsQuery);
          if (!querySnapshot.empty) {
            billDoc = querySnapshot.docs[0];
            console.log('Found bill by bill number:', billDoc.id);
          }
        } else {
          // If not a clear bill number, fetch all bills and search
          console.log('Searching all bills as fallback...');
          const allBillsQuery = query(collection(db, 'bills'));
          const allBills = await getDocs(allBillsQuery);
          
          // Look for any match in id or billId fields
          for (const doc of allBills.docs) {
            const data = doc.data();
            if (doc.id === billId || data.billId === billId || 
                doc.id.toLowerCase() === billId.toLowerCase() || 
                data.billId?.toLowerCase() === billId.toLowerCase()) {
              billDoc = doc;
              console.log('Found bill through comprehensive search:', billDoc.id);
              break;
            }
          }
        }
        
        // Update URL to use the document ID for future reference if we found the bill
        if (billDoc && billDoc.exists()) {
          window.history.replaceState(null, '', `/billing/${billDoc.id}`);
        }
      }
      
      if (billDoc && billDoc.exists()) {
        const billData = { id: billDoc.id, ...billDoc.data() } as Bill;
        console.log('Bill found:', billData);
        setBill(billData);
      } else {
        console.error('Bill document not found for ID:', billId);
        toast({
          title: "Error",
          description: `Bill not found. The bill with ID "${billId}" does not exist or may have been deleted.`,
          variant: "destructive",
        });
        navigate('/billing');
      }
    } catch (error) {
      console.error('Error fetching bill:', error);
      toast({
        title: "Error",
        description: "Failed to fetch bill details. Please check your connection and try again.",
        variant: "destructive",
      });
      navigate('/billing');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!bill || !window.confirm(`Are you sure you want to delete bill ${bill.billId}? This action cannot be undone.`)) return;
    
    try {
      console.log('Deleting bill with ID:', bill.id, 'and bill number:', bill.billId);
      
      // If this bill is linked to an order, update the order's bill status
      if (bill.orderId) {
        try {
          const orderDoc = await getDoc(doc(db, 'orders', bill.orderId));
          if (orderDoc.exists() && orderDoc.data().billId === bill.id) {
            await updateDoc(doc(db, 'orders', bill.orderId), {
              billGenerated: false,
              billId: null,
              billNumber: null,
              updatedAt: new Date()
            });
            console.log('Updated order bill reference');
          }
        } catch (orderError) {
          console.error('Error updating order reference:', orderError);
          // Continue with bill deletion even if order update fails
        }
      }
      
      // Check if the bill exists before trying to delete
      const billDocRef = doc(db, 'bills', bill.id);
      const billDocSnapshot = await getDoc(billDocRef);
      
      if (!billDocSnapshot.exists()) {
        console.error('Bill does not exist in Firestore:', bill.id);
        toast({
          title: "Warning",
          description: `Bill ${bill.billId} already deleted or doesn't exist.`,
          variant: "destructive",
        });
        navigate('/billing');
        return;
      }
      
      // Restore inventory for any inventory items used in the bill
      if (bill.items && bill.items.some(item => item.inventoryId)) {
        try {
          const { restoreInventoryForBillItems } = await import('@/utils/inventoryMaterialsHelper');
          const result = await restoreInventoryForBillItems(bill.items);
          console.log('Inventory restoration result:', result);
        } catch (inventoryError) {
          console.error('Error restoring inventory:', inventoryError);
          // Continue with bill deletion even if inventory restoration fails
        }
      }
      
      // Delete the bill document
      await deleteDoc(billDocRef);
      
      // Verify deletion was successful
      const verifyDoc = await getDoc(billDocRef);
      if (!verifyDoc.exists()) {
        console.log('Bill deleted from Firestore successfully - verified');
        toast({
          title: "Success",
          description: `Bill ${bill.billId} deleted successfully`,
        });
        navigate('/billing');
      } else {
        console.error('Bill document still exists after deletion attempt');
        toast({
          title: "Error",
          description: `Failed to delete bill ${bill.billId}. Please try again.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting bill:', error);
      toast({
        title: "Error",
        description: `Failed to delete bill ${bill.billId}. Please try again.`,
        variant: "destructive",
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
        description: "Invoice has been downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareBill = async () => {
    if (!bill) return;
    
    setSharing(true);
    try {
      // Generate or get existing share token
      const token = await getOrCreateShareToken(bill.id);
      
      // Generate public bill URL
      const publicUrl = generatePublicBillUrl(token);
      
      // Generate WhatsApp share URL
      const whatsappUrl = generateWhatsAppShareUrl(bill.customerPhone, publicUrl);
      
      // Open WhatsApp
      window.open(whatsappUrl, '_blank');
      
      toast({
        title: "✅ Bill Shared",
        description: "Opening WhatsApp to share bill link",
      });
    } catch (error) {
      console.error('Error sharing bill:', error);
      toast({
        title: "Error",
        description: "Failed to generate share link. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSharing(false);
    }
  };

  const handleBillSave = async (updatedBill: BillCreate) => {
    try {
      // For updates, we need the bill ID, so use the current bill's ID if not provided
      const billId = updatedBill.id || bill?.id;
      if (!billId) {
        throw new Error('Bill ID is required for updates');
      }
      
      // Update bill in Firestore
      await updateDoc(doc(db, 'bills', billId), {
        ...updatedBill,
        updatedAt: new Date(),
      });
      
      toast({
        title: "Success",
        description: `Bill ${updatedBill.billId} updated successfully`,
      });
      
      setShowEditDialog(false);
      // Refresh bill data
      await fetchBill();
    } catch (error) {
      console.error('Error updating bill:', error);
      toast({
        title: "Error",
        description: "Failed to update bill",
        variant: "destructive",
      });
    }
  };

  const handlePrintBill = async () => {
    if (!bill) return;
    
    try {
      await printBill(bill);
      toast({
        title: "Print Ready",
        description: "Invoice is ready for printing",
      });
    } catch (error) {
      console.error('Error printing bill:', error);
      toast({
        title: "Print Failed",
        description: "Failed to prepare invoice for printing. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePayWithUPI = () => {
    if (!bill) return;
    
    if (bill.upiLink) {
      window.open(bill.upiLink, '_blank');
    } else {
      toast({
        title: "UPI Link Not Available",
        description: "UPI payment link is not configured for this bill",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/billing')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
        </div>
        <div className="text-center py-8">Loading bill details...</div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/billing')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
        </div>
        <div className="text-center py-8">Bill not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header - Responsive */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/billing')} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bill {bill.billId}</h1>
            <div className="space-y-1 text-sm sm:text-base text-gray-500">
              <p>Created: {formatDateForDisplay(bill.createdAt)}</p>
              {bill.updatedAt && (
                <p>Last Updated: {formatDateForDisplay(bill.updatedAt)}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons - Responsive */}
        <div className="flex flex-wrap gap-2">
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Bill {bill.billId}</DialogTitle>
              </DialogHeader>
              <BillFormAdvanced 
                billId={bill.id}
                bill={bill} 
                onSave={handleBillSave}
                onCancel={() => setShowEditDialog(false)}
                onSuccess={() => {
                  setShowEditDialog(false);
                  fetchBill();
                }} 
              />
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" onClick={handleDownloadPDF} disabled={downloading} size="sm">
            <Download className="h-4 w-4 mr-2" />
            {downloading ? 'Downloading...' : 'PDF'}
          </Button>

          <Button variant="outline" onClick={handlePrintBill} size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleShareBill}
            disabled={sharing}
            className="text-green-600 hover:bg-green-50"
            size="sm"
          >
            <Share2 className="h-4 w-4 mr-2" />
            {sharing ? 'Sharing...' : 'Share Bill'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setShowWhatsAppModal(true)}
            className="text-blue-600"
            size="sm"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
          
          <Button variant="outline" onClick={handleDelete} className="text-red-600" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Bill Content - Responsive Layout */}
      <div className="max-w-6xl mx-auto">
        {/* Header Card */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="text-center bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            <CardTitle className="text-xl sm:text-2xl">{businessSettings?.businessName || 'Business Management'}</CardTitle>
            <p className="text-purple-100 text-sm sm:text-base">Premium Tailoring & Fashion</p>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Bill Details</h3>
                <div className="text-sm space-y-1">
                  <p><strong>Bill No:</strong> {bill.billId}</p>
                  <p><strong>Date:</strong> {formatDateForDisplay(bill.date)}</p>
                  {bill.orderId && <p><strong>Order ID:</strong> {bill.orderId}</p>}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Customer Details</h3>
                <div className="text-sm space-y-1">
                  <p><strong>Name:</strong> {bill.customerName}</p>
                  <p><strong>Phone:</strong> {bill.customerPhone}</p>
                  {bill.customerEmail && <p><strong>Email:</strong> {bill.customerEmail}</p>}
                  {bill.customerAddress && <p><strong>Address:</strong> {bill.customerAddress}</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Table - Responsive */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Bill Items</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-3">
              {/* Products Structure */}
              {bill.products && bill.products.length > 0 ? (
                (() => {
                  let serialNumber = 1;
                  return bill.products.map((product, productIndex) => (
                    <div key={productIndex} className="border rounded-lg bg-gray-50">
                      <div className="font-semibold p-3 bg-purple-50 border-b flex items-center gap-2">
                        <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                          {serialNumber++}
                        </div>
                        <span>{product.name} - {formatCurrency(product.total)}</span>
                      </div>
                      {product.descriptions.map((desc, descIndex) => (
                        <div key={descIndex} className="p-3 border-b last:border-b-0">
                          <div className="flex items-center gap-2 font-medium">
                            <div className="w-4 h-4 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs">
                              {descIndex + 1}
                            </div>
                            <span>{desc.description}</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1 ml-6">
                            Qty: {desc.qty} × Rate: {formatCurrency(desc.rate)}
                          </div>
                          <div className="text-right font-medium text-purple-600 ml-6">
                            {formatCurrency(desc.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()
              ) : (
                /* Legacy Items Structure */
                (() => {
                  let serialNumber = 1;
                  return bill.items.map((item, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center gap-2 font-medium">
                        <div className="w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                          {serialNumber++}
                        </div>
                        <span>{item.description}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1 ml-8">
                        Qty: {item.quantity} × Rate: {formatCurrency(item.rate || 0)}
                      </div>
                      <div className="text-right font-medium text-purple-600 ml-8">
                        {formatCurrency(item.amount || 0)}
                      </div>
                    </div>
                  ));
                })()
              )}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Items Subtotal</span>
                <span>
                  {formatCurrency(
                    bill.products && bill.products.length > 0
                      ? bill.products.reduce((sum, product) => sum + product.total, 0)
                      : bill.items.reduce((sum, item) => sum + (item.amount || 0), 0)
                  )}
                </span>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">S.No</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Products Structure */}
                  {bill.products && bill.products.length > 0 ? (
                    (() => {
                      let serialNumber = 1;
                      return bill.products.map((product, productIndex) => 
                        product.descriptions.map((desc, descIndex) => (
                          <TableRow key={`${productIndex}-${descIndex}`}>
                            {descIndex === 0 && (
                              <>
                                <TableCell 
                                  rowSpan={product.descriptions.length} 
                                  className="text-center font-medium bg-gray-50 border-r"
                                >
                                  {serialNumber++}
                                </TableCell>
                                <TableCell 
                                  rowSpan={product.descriptions.length} 
                                  className="font-semibold bg-purple-50 border-r"
                                >
                                  {product.name}
                                </TableCell>
                              </>
                            )}
                            <TableCell>{desc.description}</TableCell>
                            <TableCell className="text-right">{desc.qty}</TableCell>
                            <TableCell className="text-right">{formatCurrency(desc.rate)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(desc.amount)}</TableCell>
                          </TableRow>
                        ))
                      );
                    })()
                  ) : (
                    /* Legacy Items Structure - Group by item type */
                    (() => {
                      const groupedItems: { [key: string]: typeof bill.items } = {};
                      
                      bill.items.forEach(item => {
                        let productName = 'General Services';
                        if (item.type === 'inventory') {
                          productName = 'Materials & Supplies';
                        } else if (item.type === 'staff') {
                          productName = 'Professional Services';
                        }
                        
                        if (!groupedItems[productName]) {
                          groupedItems[productName] = [];
                        }
                        groupedItems[productName].push(item);
                      });
                      
                      let serialNumber = 1;
                      return Object.entries(groupedItems).map(([productName, items]) =>
                        items.map((item, itemIndex) => (
                          <TableRow key={`${productName}-${itemIndex}`}>
                            {itemIndex === 0 && (
                              <>
                                <TableCell 
                                  rowSpan={items.length} 
                                  className="text-center font-medium bg-gray-50 border-r"
                                >
                                  {serialNumber++}
                                </TableCell>
                                <TableCell 
                                  rowSpan={items.length} 
                                  className="font-semibold bg-purple-50 border-r"
                                >
                                  {productName}
                                </TableCell>
                              </>
                            )}
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.rate || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.amount || 0)}</TableCell>
                          </TableRow>
                        ))
                      );
                    })()
                  )}
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">Items Subtotal</TableCell>
                    <TableCell className="font-semibold text-right">
                      {formatCurrency(
                        bill.products && bill.products.length > 0
                          ? bill.products.reduce((sum, product) => sum + product.total, 0)
                          : bill.items.reduce((sum, item) => sum + (item.amount || 0), 0)
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Bill Summary - Single Card */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Bill Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(bill.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST ({bill.gstPercent}%)</span>
                <span>{formatCurrency(bill.gstAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Discount</span>
                <span>-{formatCurrency(bill.discount || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-base sm:text-lg border-t pt-2">
                <span>Total Amount</span>
                <span className="text-purple-600">{formatCurrency(bill.totalAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Paid Amount</span>
                <span className="text-green-600">{formatCurrency(bill.paidAmount || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-base sm:text-lg">
                <span>Balance</span>
                <span className={getBillStatusColor(bill.status).includes('red') ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(bill.balance || 0)}
                </span>
              </div>
              
              {/* Pay with UPI Section - Now inside Bill Summary */}
              {(bill.balance || 0) > 0 && (
                <div className="border-t pt-3 mt-3 space-y-2">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Payment</div>
                  <Button onClick={handlePayWithUPI} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" size="sm">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay with UPI - {formatCurrency(bill.balance || 0)}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Details Section - Enhanced */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Bank Details */}
              <div>
                <h3 className="font-semibold mb-3 text-sm sm:text-base">Bank Transfer</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Account Name:</strong> {bill.bankDetails.accountName}</p>
                  <p><strong>Account Number:</strong> {bill.bankDetails.accountNumber}</p>
                  <p><strong>IFSC Code:</strong> {bill.bankDetails.ifsc}</p>
                  <p><strong>Bank Name:</strong> {bill.bankDetails.bankName}</p>
                </div>
              </div>

              {/* UPI Payment & QR Code - Enhanced */}
              <div>
                <h3 className="font-semibold mb-3 text-sm sm:text-base">UPI Payment & QR Code</h3>
                <div className="space-y-3">
                  {/* QR Code Display - Default amount is balance */}
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                    {bill.qrCodeUrl ? (
                      <img src={bill.qrCodeUrl} alt="UPI QR Code" className="w-32 h-32 mx-auto mb-2" />
                    ) : (
                      <div className="w-32 h-32 mx-auto bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center mb-2">
                        <QrCode className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Scan to pay: <strong>{formatCurrency(bill.balance || 0)}</strong>
                    </p>
                  </div>
                  
                  {/* Enlarged QR Code Dialog */}
                  <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full" size="sm">
                        <QrCode className="h-4 w-4 mr-2" />
                        View Large QR Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>UPI QR Code - {formatCurrency(bill.balance || 0)}</DialogTitle>
                      </DialogHeader>
                      <div className="text-center">
                        {bill.qrCodeUrl ? (
                          <img src={bill.qrCodeUrl} alt="UPI QR Code" className="w-48 h-48 mx-auto" />
                        ) : (
                          <div className="w-48 h-48 mx-auto bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                            <div className="text-center">
                              <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-500 text-sm">QR Code Not Available</p>
                            </div>
                          </div>
                        )}
                        <p className="mt-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          Scan this QR code with any UPI app to pay the outstanding balance of <strong>{formatCurrency(bill.balance || 0)}</strong>
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Screenshot Section */}
        {bill.paymentScreenshot && (
          <Card className="mb-4 sm:mb-6 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-600" />
                Payment Screenshot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div 
                  className="relative cursor-pointer group"
                  onClick={() => setShowScreenshotModal(true)}
                >
                  <img
                    src={bill.paymentScreenshot}
                    alt="Payment Screenshot"
                    className="w-20 h-20 object-cover rounded-lg border-2 border-green-300 group-hover:border-green-500 transition-all"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-all flex items-center justify-center">
                    <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-semibold">View Full</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">
                    Payment screenshot uploaded by customer
                  </p>
                  {bill.paymentScreenshotUploadedAt && (
                    <p className="text-xs text-green-600 mt-1">
                      Uploaded: {formatDateForDisplay(bill.paymentScreenshotUploadedAt)}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Open in new tab for full view
                    window.open(bill.paymentScreenshot, '_blank');
                  }}
                  className="border-green-300 hover:bg-green-100"
                >
                  Open in New Tab
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Screenshot Modal */}
        <Dialog open={showScreenshotModal} onOpenChange={setShowScreenshotModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Payment Screenshot</DialogTitle>
            </DialogHeader>
            <div className="relative p-4">
              <img
                src={bill.paymentScreenshot}
                alt="Payment Screenshot"
                className="w-full h-auto max-h-[calc(90vh-150px)] object-contain rounded-lg"
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(bill.paymentScreenshot, '_blank')}
                >
                  Open in New Tab
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScreenshotModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 mb-2 text-sm sm:text-base">Thank you for choosing {businessSettings?.businessName || 'us'}!</p>
            <p className="text-xs sm:text-sm text-gray-500">
              For any queries, please contact us. Payment due within 7 days.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <BillWhatsAppAdvanced
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
          customerName={bill.customerName}
          customerPhone={bill.customerPhone}
          billId={bill.billId}
          totalAmount={bill.totalAmount || 0}
          balance={bill.balance || 0}
          upiLink={bill.upiLink}
        />
      )}
    </div>
  );
};

export default BillDetails;
