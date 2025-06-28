export interface BillItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  chargeType?: string;
  materialName?: string;
  materialCost?: number;
  inventoryId?: string;
}

export interface BillBreakdown {
  fabric: number;
  stitching: number;
  accessories: number;
  customization: number;
  otherCharges: number;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  type: 'cash' | 'online' | 'split';
  cashAmount?: number;
  onlineAmount?: number;
  paymentDate: any;
  notes?: string;
}

export interface Bill {
  id: string;
  billId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  orderId?: string;
  items: BillItem[];
  breakdown: BillBreakdown;
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  discount: number;
  discountType: 'amount' | 'percentage';
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: 'paid' | 'partial' | 'unpaid';
  paymentRecords?: PaymentRecord[];
  totalCashReceived?: number;
  totalOnlineReceived?: number;
  date: any;
  dueDate?: any;
  bankDetails: BankDetails;
  upiId: string;
  upiLink: string;
  qrCodeUrl: string;
  qrAmount?: number; // This should default to balance amount
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

// Interface for creating new bills (without id since Firestore generates it)
export interface BillCreate extends Omit<Bill, 'id'> {
  id?: string;
}

export const generateBillId = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  return `BILL${timestamp}`;
};

export const generateUPILink = (
  upiId: string,
  customerName: string,
  amount: number,
  billId: string,
  orderName?: string,  // Optional order name
  madeFor?: string,    // Optional order recipient
  orderId?: string,    // Optional order ID
  deliveryDate?: string // Optional delivery date
): string => {
  // Create payment message with all available details
  let paymentMessage = `Bill ${billId}`;
  
  if (orderName) {
    paymentMessage += ` - ${orderName}`;
  }
  
  if (madeFor) {
    paymentMessage += ` - Made for ${madeFor}`;
  }
  
  if (orderId) {
    paymentMessage += ` - Order #${orderId}`;
  }
  
  if (deliveryDate) {
    paymentMessage += ` - Delivery: ${deliveryDate}`;
  }
  
  // For Swetha's Couture
  paymentMessage += ` - Swetha's Couture`;
  
  const encodedNote = encodeURIComponent(paymentMessage);
  const encodedName = encodeURIComponent(customerName);
  return `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}`;
};

export const calculateBillTotals = (
  items: BillItem[],
  breakdown: BillBreakdown,
  gstPercent: number,
  discount: number,
  discountType: 'amount' | 'percentage' = 'amount'
) => {
  const itemsTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const breakdownTotal = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const subtotal = itemsTotal + breakdownTotal;
  const gstAmount = (subtotal * gstPercent) / 100;
  
  let discountAmount = discount;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * discount) / 100;
  }
  
  const totalAmount = subtotal + gstAmount - discountAmount;
  
  return {
    subtotal,
    gstAmount,
    totalAmount: Math.max(0, totalAmount),
    discountAmount
  };
};

export const generateQRCodeDataURL = async (upiLink: string): Promise<string> => {
  try {
    const QRCode = (await import('qrcode')).default;
    return await QRCode.toDataURL(upiLink, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
};

export const formatCurrency = (amount: number | undefined | null): string => {
  const validAmount = amount || 0;
  return `₹${validAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const getBillStatusColor = (status: string): string => {
  switch (status) {
    case 'paid': return 'text-green-600 bg-green-100';
    case 'partial': return 'text-yellow-600 bg-yellow-100';
    case 'unpaid': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

export const calculateBillStatus = (totalAmount: number, paidAmount: number): 'paid' | 'partial' | 'unpaid' => {
  if (paidAmount >= totalAmount) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
};

export const getWhatsAppTemplates = (
  customerName: string,
  billId: string,
  totalAmount: number,
  balance: number,
  upiLink: string,
  dueDate?: string
) => ({
  billDelivery: `Hello ${customerName}! 🪡✨\n\nYour bill ${billId} for ${formatCurrency(totalAmount)} is ready from Swetha's Couture.\n\nPay conveniently via UPI: ${upiLink}\n\nOr scan the QR code attached. Thank you for choosing us! 💜`,
  
  paymentReminder: `Dear ${customerName},\n\nFriendly reminder: Your pending balance for bill ${billId} is ${formatCurrency(balance)}.\n\n${dueDate ? `Due date: ${dueDate}\n\n` : ''}Please complete payment via UPI: ${upiLink}\n\nThank you for your understanding! 🙏`,
  
  thankYou: `Dear ${customerName},\n\nThank you for your payment! ✨ We've received your settlement for bill ${billId}.\n\nWe truly appreciate your business and look forward to serving you again at Swetha's Couture! 🪡💜`,
  
  custom1: `Hi ${customerName}! Your custom order is ready for pickup. Bill ${billId} - ${formatCurrency(totalAmount)}. Pay via: ${upiLink}`,
  
  custom2: `Dear ${customerName}, your alteration work is complete! Please review bill ${billId} and make payment. Thanks!`,
  
  custom3: `${customerName}, your exclusive design is ready! Bill ${billId} for ${formatCurrency(totalAmount)}. Secure payment: ${upiLink}`
});

export const downloadPDF = async (bill: Bill) => {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    
    // Create a temporary div with professional bill content
    const element = document.createElement('div');
    element.innerHTML = generateProfessionalBillHTML(bill);
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.background = 'white';
    element.style.padding = '40px';
    element.style.width = '800px';
    element.style.fontFamily = 'Arial, sans-serif';
    
    document.body.appendChild(element);
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: false
    });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    
    let position = 0;
    
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    pdf.save(`Swetha-Couture-Bill-${bill.billId}.pdf`);
    document.body.removeChild(element);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

const generateProfessionalBillHTML = (bill: Bill): string => {
  const qrCodeSection = bill.qrCodeUrl ? `
    <div style="text-align: center; margin-top: 20px;">
      <h4 style="color: #374151; margin-bottom: 10px;">UPI Payment QR Code</h4>
      <img src="${bill.qrCodeUrl}" alt="UPI QR Code" style="width: 120px; height: 120px; border: 2px solid #e5e7eb; border-radius: 8px;">
      <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">Scan to pay ₹${bill.balance}</p>
    </div>
  ` : '';

  const paymentRecordsSection = bill.paymentRecords && bill.paymentRecords.length > 0 ? `
    <div style="margin-top: 30px;">
      <h3 style="color: #374151; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px;">Payment History</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px;">Date</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px;">Type</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-size: 12px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${bill.paymentRecords.map(payment => `
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 8px; font-size: 11px;">
                ${new Date(payment.paymentDate?.toDate?.() || payment.paymentDate).toLocaleDateString()}
              </td>
              <td style="border: 1px solid #e5e7eb; padding: 8px; font-size: 11px; text-transform: capitalize;">
                ${payment.type === 'split' ? `Split (Cash: ${formatCurrency(payment.cashAmount || 0)}, Online: ${formatCurrency(payment.onlineAmount || 0)})` : payment.type}
              </td>
              <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-size: 11px;">
                ${formatCurrency(payment.amount)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="text-align: center; background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%); color: white; padding: 30px 20px; position: relative;">
        <h1 style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 1px;">SWETHA'S COUTURE</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Premium Tailoring & Fashion Excellence</p>
        <div style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px;">
          <span style="font-size: 14px; font-weight: bold;">INVOICE</span>
        </div>
      </div>
      
      <!-- Bill Info Section -->
      <div style="padding: 30px 40px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 40px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 250px; margin-right: 20px;">
            <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 18px; border-bottom: 2px solid #7c3aed; display: inline-block; padding-bottom: 5px;">Bill Details</h3>
            <div style="line-height: 1.8;">
              <p style="margin: 8px 0; font-size: 14px;"><strong style="color: #374151;">Bill Number:</strong> <span style="color: #7c3aed; font-weight: bold;">${bill.billId}</span></p>
              <p style="margin: 8px 0; font-size: 14px;"><strong style="color: #374151;">Date:</strong> ${new Date(bill.date?.toDate?.() || bill.date).toLocaleDateString('en-IN')}</p>
              ${bill.dueDate ? `<p style="margin: 8px 0; font-size: 14px;"><strong style="color: #374151;">Due Date:</strong> ${new Date(bill.dueDate?.toDate?.() || bill.dueDate).toLocaleDateString('en-IN')}</p>` : ''}
              ${bill.orderId ? `<p style="margin: 8px 0; font-size: 14px;"><strong style="color: #374151;">Order ID:</strong> ${bill.orderId}</p>` : ''}
            </div>
          </div>
          <div style="flex: 1; min-width: 250px;">
            <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 18px; border-bottom: 2px solid #7c3aed; display: inline-block; padding-bottom: 5px;">Customer Details</h3>
            <div style="line-height: 1.8;">
              <p style="margin: 8px 0; font-size: 14px;"><strong style="color: #374151;">Name:</strong> ${bill.customerName}</p>
              <p style="margin: 8px 0; font-size: 14px;"><strong style="color: #374151;">Phone:</strong> ${bill.customerPhone}</p>
              ${bill.customerEmail ? `<p style="margin: 8px 0; font-size: 14px;"><strong style="color: #374151;">Email:</strong> ${bill.customerEmail}</p>` : ''}
              ${bill.customerAddress ? `<p style="margin: 8px 0; font-size: 14px;"><strong style="color: #374151;">Address:</strong> ${bill.customerAddress}</p>` : ''}
            </div>
          </div>
        </div>
        
        <!-- Items Table -->
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 18px;">Itemized Services</h3>
          <table style="width: 100%; border-collapse: collapse; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%); color: white;">
                <th style="padding: 15px; text-align: left; font-weight: 600;">Description</th>
                <th style="padding: 15px; text-align: center; font-weight: 600; width: 80px;">Qty</th>
                <th style="padding: 15px; text-align: right; font-weight: 600; width: 120px;">Rate</th>
                <th style="padding: 15px; text-align: right; font-weight: 600; width: 120px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${bill.items.map((item, index) => `
                <tr style="background-color: ${index % 2 === 0 ? '#f9fafb' : 'white'}; border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px 15px; font-size: 13px;">${item.description}</td>
                  <td style="padding: 12px 15px; text-align: center; font-size: 13px;">${item.quantity}</td>
                  <td style="padding: 12px 15px; text-align: right; font-size: 13px;">${formatCurrency(item.rate)}</td>
                  <td style="padding: 12px 15px; text-align: right; font-size: 13px; font-weight: 600;">${formatCurrency(item.amount)}</td>
                </tr>
              `).join('')}
              <tr style="background-color: #f3f4f6; border-top: 2px solid #7c3aed;">
                <td colspan="3" style="padding: 12px 15px; font-weight: bold; font-size: 14px;">Items Subtotal</td>
                <td style="padding: 12px 15px; text-align: right; font-weight: bold; font-size: 14px;">
                  ${formatCurrency(bill.items.reduce((sum, item) => sum + item.amount, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Bill Summary -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
          <div style="width: 350px; background: #f9fafb; padding: 25px; border-radius: 12px; border-left: 4px solid #7c3aed;">
            <h3 style="color: #1f2937; margin-bottom: 20px; font-size: 18px;">Bill Summary</h3>
            <div style="space-y: 10px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-size: 14px; color: #374151;">Subtotal</span>
                <span style="font-size: 14px; font-weight: 600;">${formatCurrency(bill.subtotal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-size: 14px; color: #374151;">GST (${bill.gstPercent}%)</span>
                <span style="font-size: 14px; font-weight: 600;">${formatCurrency(bill.gstAmount)}</span>
              </div>
              ${bill.discount > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="font-size: 14px; color: #374151;">Discount</span>
                  <span style="font-size: 14px; font-weight: 600; color: #059669;">-${formatCurrency(bill.discount)}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 2px solid #7c3aed; background: white; margin: 10px -10px; padding-left: 10px; padding-right: 10px;">
                <span style="font-size: 16px; font-weight: bold; color: #1f2937;">Total Amount</span>
                <span style="font-size: 16px; font-weight: bold; color: #7c3aed;">${formatCurrency(bill.totalAmount)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-size: 14px; color: #374151;">Paid Amount</span>
                <span style="font-size: 14px; font-weight: 600; color: #059669;">${formatCurrency(bill.paidAmount)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 12px 0;">
                <span style="font-size: 16px; font-weight: bold; color: #1f2937;">Balance Due</span>
                <span style="font-size: 16px; font-weight: bold; color: ${bill.balance > 0 ? '#dc2626' : '#059669'};">${formatCurrency(bill.balance)}</span>
              </div>
            </div>
          </div>
        </div>

        ${paymentRecordsSection}
        
        <!-- Payment Information -->
        <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 30px; border-radius: 12px; margin-bottom: 30px;">
          <h3 style="color: #1f2937; margin-bottom: 20px; font-size: 18px; text-align: center;">Payment Information</h3>
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
            <!-- Bank Details -->
            <div style="flex: 1; min-width: 250px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h4 style="color: #7c3aed; margin-bottom: 15px; font-size: 16px;">Bank Transfer</h4>
              <div style="line-height: 1.6;">
                <p style="margin: 6px 0; font-size: 13px;"><strong>Account Name:</strong> ${bill.bankDetails.accountName}</p>
                <p style="margin: 6px 0; font-size: 13px;"><strong>Account Number:</strong> ${bill.bankDetails.accountNumber}</p>
                <p style="margin: 6px 0; font-size: 13px;"><strong>IFSC Code:</strong> ${bill.bankDetails.ifsc}</p>
                <p style="margin: 6px 0; font-size: 13px;"><strong>Bank Name:</strong> ${bill.bankDetails.bankName}</p>
              </div>
            </div>
            
            <!-- UPI Details -->
            <div style="flex: 1; min-width: 250px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
              <h4 style="color: #7c3aed; margin-bottom: 15px; font-size: 16px;">UPI Payment</h4>
              <p style="margin: 10px 0; font-size: 13px;"><strong>UPI ID:</strong> ${bill.upiId}</p>
              ${qrCodeSection}
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 30px 0; border-top: 2px solid #e5e7eb; margin-top: 40px;">
          <p style="color: #7c3aed; font-size: 16px; font-weight: bold; margin-bottom: 10px;">Thank you for choosing Swetha's Couture!</p>
          <p style="color: #6b7280; font-size: 13px; margin-bottom: 5px;">For any queries, please contact us.</p>
          <p style="color: #6b7280; font-size: 13px;">Payment terms: Due within 7 days from bill date.</p>
          ${bill.notes ? `<p style="color: #374151; font-size: 12px; margin-top: 15px; font-style: italic; background: #f9fafb; padding: 10px; border-radius: 6px;"><strong>Note:</strong> ${bill.notes}</p>` : ''}
        </div>
      </div>
    </div>
  `;
};

/**
 * Check if a bill exists by ID
 */
export const checkBillExists = async (billId: string): Promise<boolean> => {
  try {
    const { getDoc, doc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    
    const billDoc = await getDoc(doc(db, 'bills', billId));
    return billDoc.exists();
  } catch (error) {
    console.error('Error checking if bill exists:', error);
    return false;
  }
};

/**
 * Get bill by ID with error handling
 */
export const getBillById = async (billId: string): Promise<Bill | null> => {
  try {
    const { getDoc, doc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    
    const billDoc = await getDoc(doc(db, 'bills', billId));
    if (billDoc.exists()) {
      return { id: billDoc.id, ...billDoc.data() } as Bill;
    }
    return null;
  } catch (error) {
    console.error('Error fetching bill by ID:', error);
    return null;
  }
};

/**
 * Find bill by order ID
 */
export const findBillByOrderId = async (orderId: string): Promise<Bill | null> => {
  try {
    const { getDocs, query, collection, where } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    
    const q = query(collection(db, 'bills'), where('orderId', '==', orderId));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const billDoc = querySnapshot.docs[0];
      return { id: billDoc.id, ...billDoc.data() } as Bill;
    }
    return null;
  } catch (error) {
    console.error('Error finding bill by order ID:', error);
    return null;
  }
};

export const printBill = (bill: Bill) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Unable to open print window. Please check your popup blocker.');
  }

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bill ${bill.billId} - Swetha's Couture</title>
      <style>
        @page {
          margin: 20mm;
          size: A4;
        }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.4;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
        }
        .header {
          text-align: center;
          background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
          color: white;
          padding: 30px 20px;
          margin-bottom: 30px;
        }
        .bill-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }
        .bill-info > div {
          flex: 1;
          min-width: 250px;
          margin-right: 20px;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .table th, .table td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        .table th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        .summary {
          float: right;
          width: 300px;
          background: #f9f9f9;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .payment-info {
          clear: both;
          background: #f9f9f9;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #eee;
        }
      </style>
    </head>
    <body>
      ${generateProfessionalBillHTML(bill)}
    </body>
    </html>
  `;

  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Wait for content to load before printing
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };
};
