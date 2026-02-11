export interface BillItem {
  id: string;
  type: 'inventory' | 'staff' | 'service'; // Type of item being billed
  sourceId?: string; // ID of inventory item, staff member, or work description
  description: string;
  quantity: number;
  rate: number; // Selling price per unit
  cost: number; // Cost per unit (from inventory, staff rate, or service cost)
  amount: number; // Total amount (quantity * rate)
  chargeType?: string;
  materialName?: string;
  materialCost?: number;
  inventoryId?: string; // Legacy field - deprecated, use sourceId instead
  subItems?: BillItem[]; // Sub-items for breakdown
  parentId?: string; // Parent item ID for sub-items
  isSubItem?: boolean; // Flag to identify sub-items
}

// New interfaces for Product + Description grouping
export interface ProductDescription {
  id: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  inventoryId?: string;   // Firestore doc id — set when added via barcode scan
  barcodeValue?: string;  // barcode value — used to match duplicate scans
}

export interface Product {
  id: string;
  name: string;
  total: number;
  descriptions: ProductDescription[];
  expanded?: boolean; // UI state for collapse/expand
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
  paymentDate: Date | any; // Allow both Date and Firebase Timestamp
  notes?: string;
}

export interface Bill {
  id: string;
  billId: string;
  billNumber?: number; // New field for sequential numbering
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  orderId?: string;
  items: BillItem[]; // Legacy field - maintained for backward compatibility
  products?: Product[]; // New field for Product + Description grouping
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
  date: any; // Date field - handles both string and Timestamp formats
  dueDate?: any; // Due date - handles both string and Timestamp formats
  bankDetails: BankDetails;
  upiId: string;
  upiLink: string;
  qrCodeUrl: string;
  qrAmount?: number; // This should default to balance amount
  notes?: string;
  paymentScreenshot?: string; // Cloudinary URL for payment screenshot uploaded by customer
  paymentScreenshotUploadedAt?: any; // Timestamp when screenshot was uploaded
  shareToken?: string; // Secure token for sharing bill
  shareTokenCreatedAt?: any; // Timestamp when share token was created
  createdAt: any; // Creation timestamp - handles both string and Timestamp formats
  updatedAt: any; // Last update timestamp - handles both string and Timestamp formats
}

// Interface for creating new bills (without id since Firestore generates it)
export interface BillCreate extends Omit<Bill, 'id'> {
  id?: string;
}

// Add new interface for business settings
export interface BusinessSettings {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  taxNumber: string;
  logo?: string;
}

export const generateBillId = async (): Promise<string> => {
  try {
    const { getDocs, query, collection, orderBy, limit } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    
    // Get all existing bill numbers to find gaps or the next number
    const billsQuery = query(
      collection(db, 'bills'), 
      orderBy('billNumber', 'asc')
    );
    
    const billsSnapshot = await getDocs(billsQuery);
    const existingNumbers = new Set<number>();
    
    // Collect all existing bill numbers
    billsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (typeof data.billNumber === 'number' && data.billNumber >= 1) {
        existingNumbers.add(data.billNumber);
      }
    });
    
    // Find the first available number starting from 1
    let nextBillNumber = 1;
    while (existingNumbers.has(nextBillNumber)) {
      nextBillNumber++;
    }
    
    // Format: Bill001, Bill002, Bill003, etc.
    const formattedNumber = nextBillNumber.toString().padStart(3, '0');
    return `Bill${formattedNumber}`;
  } catch (error) {
    console.error('Error generating sequential bill ID:', error);
    // Fallback to timestamp-based ID if database query fails
    const timestamp = Date.now().toString().slice(-6);
    return `BILL${timestamp}`;
  }
};

// Utility function to handle date formatting consistently
export const formatBillDate = (date: any): Date => {
  if (!date) return new Date();
  
  // If it's already a Date object
  if (date instanceof Date) {
    return date;
  }
  
  // If it's a Firebase Timestamp with toDate method
  if (date && typeof date === 'object' && typeof date.toDate === 'function') {
    try {
      return date.toDate();
    } catch (error) {
      console.error('Error converting Firebase timestamp:', error);
      return new Date();
    }
  }
  
  // If it's a Firebase Timestamp with seconds and nanoseconds
  if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
    try {
      return new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
    } catch (error) {
      console.error('Error converting timestamp object:', error);
      return new Date();
    }
  }
  
  // If it's a string or number
  if (typeof date === 'string' || typeof date === 'number') {
    try {
      const parsedDate = new Date(date);
      return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    } catch (error) {
      console.error('Error parsing date string/number:', error);
      return new Date();
    }
  }
  
  // Fallback to current date
  console.warn('Unknown date format, using current date:', date);
  return new Date();
};

// Utility function to format date for display consistently
export const formatDateForDisplay = (date: any, locale: string = 'en-IN'): string => {
  try {
    const validDate = formatBillDate(date);
    return validDate.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date for display:', error);
    return 'Invalid Date';
  }
};

export const generateUPILink = async (
  upiId: string,
  customerName: string,
  amount: number,
  billId: string,
  orderName?: string,  // Optional order name
  madeFor?: string,    // Optional order recipient
  orderId?: string,    // Optional order ID
  deliveryDate?: string // Optional delivery date
): Promise<string> => {
  // Get company name dynamically
  const { getCompanyInfo } = await import('@/utils/settingsUtils');
  const companyInfo = await getCompanyInfo();
  
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
  
  // Use dynamic company name
  paymentMessage += ` - ${companyInfo.name}`;
  
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
  // Ensure all items have properly calculated amounts, especially for floating-point quantities
  const itemsWithCorrectAmounts = items.map(item => {
    // Recalculate amount to ensure floating-point precision
    const safeQuantity = typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 0;
    const safeRate = typeof item.rate === 'number' && !isNaN(item.rate) ? item.rate : 0;
    const calculatedAmount = safeQuantity * safeRate;
    
    return {
      ...item,
      amount: calculatedAmount
    };
  });

  // Filter out items with zero or invalid amounts after recalculation
  const validItems = itemsWithCorrectAmounts.filter(item => 
    typeof item.amount === 'number' && 
    !isNaN(item.amount) && 
    item.amount > 0
  );

  // Sanitize breakdown inputs
  const safeBreakdown = Object.fromEntries(
    Object.entries(breakdown).map(([key, value]) => [key, isNaN(value) ? 0 : value])
  ) as BillBreakdown;
  const safeGstPercent = isNaN(gstPercent) ? 0 : gstPercent;
  const safeDiscount = isNaN(discount) ? 0 : discount;
  
  // Calculate totals with proper floating-point handling
  const itemsTotal = validItems.reduce((sum, item) => {
    const amount = typeof item.amount === 'number' && !isNaN(item.amount) ? item.amount : 0;
    return sum + amount;
  }, 0);
  
  const breakdownTotal = Object.values(safeBreakdown).reduce((sum, value) => sum + (value || 0), 0);
  const subtotal = itemsTotal + breakdownTotal;
  const gstAmount = (subtotal * safeGstPercent) / 100;
  
  let discountAmount = safeDiscount;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * safeDiscount) / 100;
  }
  
  const totalAmount = subtotal + gstAmount - discountAmount;
  
  // Round to 2 decimal places to handle floating-point precision issues
  return {
    subtotal: Math.max(0, Math.round(subtotal * 100) / 100),
    gstAmount: Math.max(0, Math.round(gstAmount * 100) / 100),
    totalAmount: Math.max(0, Math.round(totalAmount * 100) / 100),
    discountAmount: Math.max(0, Math.round(discountAmount * 100) / 100)
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

export const getWhatsAppTemplates = async (
  customerName: string,
  billId: string,
  totalAmount: number,
  balance: number,
  upiLink: string,
  dueDate?: string
) => {
  // Get company name dynamically
  const { getCompanyInfo } = await import('@/utils/settingsUtils');
  const companyInfo = await getCompanyInfo();
  
  return {
    billDelivery: `Hello ${customerName}! 🪡✨\n\nYour bill ${billId} for ${formatCurrency(totalAmount)} is ready from ${companyInfo.name}.\n\nPay conveniently via UPI: ${upiLink}\n\nOr scan the QR code attached. Thank you for choosing us! 💜`,
    
    paymentReminder: `Dear ${customerName},\n\nFriendly reminder: Your pending balance for bill ${billId} is ${formatCurrency(balance)}.\n\n${dueDate ? `Due date: ${dueDate}\n\n` : ''}Please complete payment via UPI: ${upiLink}\n\nThank you for your understanding! 🙏`,
    
    thankYou: `Dear ${customerName},\n\nThank you for your payment! ✨ We've received your settlement for bill ${billId}.\n\nWe truly appreciate your business and look forward to serving you again at ${companyInfo.name}! 🪡💜`,
    
    custom1: `Hi ${customerName}! Your custom order is ready for pickup. Bill ${billId} - ${formatCurrency(totalAmount)}. Pay via: ${upiLink}`,
    
    custom2: `Dear ${customerName}, your alteration work is complete! Please review bill ${billId} and make payment. Thanks!`,
    
    custom3: `${customerName}, your exclusive design is ready! Bill ${billId} for ${formatCurrency(totalAmount)}. Secure payment: ${upiLink}`
  };
};

export const downloadPDF = async (bill: Bill) => {
  let element: HTMLDivElement | null = null;
  
  try {
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    
    // Create a temporary div with Zylker-style bill content
    element = document.createElement('div');
    element.innerHTML = await generateZylkerStyleBillHTML(bill);
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.background = 'white';
    element.style.padding = '0';
    element.style.margin = '0';
    element.style.width = '680px'; // A4 width in pixels at 96 DPI (180mm ≈ 680px)
    // Removed the fixed height constraint to allow content to expand naturally
    element.style.fontFamily = 'Arial, Helvetica, sans-serif';
    element.style.fontSize = '11pt';
    element.style.lineHeight = '1.4'; // Increased line height for better readability
    element.style.color = '#333333';
    element.style.boxSizing = 'border-box';
    
    document.body.appendChild(element);
    
    // Wait for fonts and images to load
    await new Promise(resolve => setTimeout(resolve, 500)); // Increased timeout for better loading
    
    // Get the actual height of the content
    const contentHeight = element.scrollHeight;
    
    // Create PDF directly with proper dimensions
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // A4 dimensions: 210 x 297 mm
    // Content area with 15mm margins: 180 x 267 mm
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15; // 15mm margins
    const contentAreaWidth = pageWidth - (margin * 2);
    const contentAreaHeight = pageHeight - (margin * 2);
    
    // Calculate how many canvas sections we need based on content height
    const pixelsPerMM = 680 / contentAreaWidth; // Conversion ratio
    const sectionHeight = Math.floor(contentAreaHeight * pixelsPerMM);
    const sectionsCount = Math.ceil(contentHeight / sectionHeight);
    
    // For each section, create a canvas and add to PDF
    for (let i = 0; i < sectionsCount; i++) {
      // If not first page, add a new page
      if (i > 0) {
        pdf.addPage();
      }
      
      // Calculate the portion of the element to render
      const sectionTop = i * sectionHeight;
      const sectionBottom = Math.min((i + 1) * sectionHeight, contentHeight);
      const currentSectionHeight = sectionBottom - sectionTop;
      
      // Create a canvas for this section
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2, // Better quality
        useCORS: true,
        allowTaint: false,
        width: 680,
        height: currentSectionHeight,
        windowWidth: 680,
        windowHeight: currentSectionHeight,
        x: 0,
        y: sectionTop,
        scrollY: -sectionTop,
        logging: false
      });
      
      // Add this section to the PDF
      const imgData = canvas.toDataURL('image/png', 1.0); // No compression for better quality
      pdf.addImage(imgData, 'PNG', margin, margin, contentAreaWidth, (currentSectionHeight / pixelsPerMM));
    }
    
    // Save with descriptive filename
    const { getCompanyInfo } = await import('@/utils/settingsUtils');
    const companyInfo = await getCompanyInfo();
    const fileName = `${companyInfo.name.replace(/[^a-zA-Z0-9]/g, '-')}-Invoice-${bill.billId}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Save the file
    pdf.save(fileName);
    
    // Clean up the temporary element
    if (element && document.body.contains(element)) {
      document.body.removeChild(element);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    // Clean up element in case of error
    if (element && document.body.contains(element)) {
      document.body.removeChild(element);
    }
    throw error;
  }
};

// Helper function to generate table rows for both products and legacy items structure
const generateItemsTableRows = (bill: Bill): string => {
  let productCounter = 0;
  
  // If bill has products (new structure), use them
  if (bill.products && bill.products.length > 0) {
    return bill.products.map(product => {
      const descriptions = product.descriptions || [];
      if (descriptions.length === 0) return '';
      
      // Increment product counter only once per product
      productCounter++;
      
      return descriptions.map((desc, index) => {
        if (index === 0) {
          // First row includes S.No and product name with rowSpan
          return `
            <tr style="border-bottom: 1px solid #e2e8f0; background: #fafbfc;">
              <td style="padding: 12px 15px; text-align: center; font-size: 14px; color: #475569; font-weight: 600; border-right: 1px solid #e2e8f0;" rowspan="${descriptions.length}">${productCounter}</td>
              <td style="padding: 12px 20px; font-size: 14px; color: #1e293b; font-weight: 700; border-right: 1px solid #e2e8f0; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);" rowspan="${descriptions.length}">
                ${product.name}
              </td>
              <td style="padding: 12px 25px; font-size: 14px; color: #374151; line-height: 1.5;">
                <div style="font-weight: 500;">${desc.description}</div>
              </td>
              <td style="padding: 12px 15px; text-align: center; font-size: 14px; color: #475569; font-weight: 600;">${desc.qty}</td>
              <td style="padding: 12px 15px; text-align: right; font-size: 14px; color: #475569; font-weight: 600;">${formatCurrency(desc.rate)}</td>
              <td style="padding: 12px 25px; text-align: right; font-size: 14px; font-weight: 600; color: #1e293b;">${formatCurrency(desc.amount)}</td>
            </tr>
          `;
        } else {
          // Subsequent rows don't include S.No and product name (covered by rowSpan)
          return `
            <tr style="border-bottom: 1px solid #e2e8f0; background: #fafbfc;">
              <td style="padding: 12px 25px; font-size: 14px; color: #374151; line-height: 1.5;">
                <div style="font-weight: 500;">${desc.description}</div>
              </td>
              <td style="padding: 12px 15px; text-align: center; font-size: 14px; color: #475569; font-weight: 600;">${desc.qty}</td>
              <td style="padding: 12px 15px; text-align: right; font-size: 14px; color: #475569; font-weight: 600;">${formatCurrency(desc.rate)}</td>
              <td style="padding: 12px 25px; text-align: right; font-size: 14px; font-weight: 600; color: #1e293b;">${formatCurrency(desc.amount)}</td>
            </tr>
          `;
        }
      }).join('');
    }).join('');
  }
  
  // Fall back to legacy items structure
  if (bill.items && bill.items.length > 0) {
    // Group legacy items by a default product name or try to extract product info
    const groupedItems: { [key: string]: typeof bill.items } = {};
    
    bill.items.forEach(item => {
      // Try to extract product name from description or use item type as grouping
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
    
    return Object.entries(groupedItems).map(([productName, items], groupIndex) => {
      // Increment product counter for each group
      productCounter++;
      
      return items.map((item, index) => {
        if (index === 0) {
          // First row includes S.No and product name with rowSpan
          return `
            <tr style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s;">
              <td style="padding: 18px 15px; text-align: center; font-size: 14px; color: #475569; font-weight: 600; border-right: 1px solid #e2e8f0;" rowspan="${items.length}">${productCounter}</td>
              <td style="padding: 18px 20px; font-size: 14px; color: #1e293b; font-weight: 700; border-right: 1px solid #e2e8f0; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);" rowspan="${items.length}">
                ${productName}
              </td>
              <td style="padding: 18px 25px; font-size: 14px; color: #1e293b; line-height: 1.5;">
                <div style="font-weight: 600; margin-bottom: 2px;">${item.description}</div>
                ${item.type === 'inventory' ? '<span style="background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">Material</span>' : 
                  item.type === 'staff' ? '<span style="background: #dcfce7; color: #059669; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">Service</span>' : 
                  '<span style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">Custom</span>'}
              </td>
              <td style="padding: 18px 15px; text-align: center; font-size: 14px; color: #475569; font-weight: 600;">${item.quantity}</td>
              <td style="padding: 18px 15px; text-align: right; font-size: 14px; color: #475569; font-weight: 600;">${formatCurrency(item.rate)}</td>
              <td style="padding: 18px 25px; text-align: right; font-size: 15px; font-weight: 700; color: #1e293b;">${formatCurrency(item.amount)}</td>
            </tr>
          `;
        } else {
          // Subsequent rows don't include S.No and product name (covered by rowSpan)
          return `
            <tr style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s;">
              <td style="padding: 18px 25px; font-size: 14px; color: #1e293b; line-height: 1.5;">
                <div style="font-weight: 600; margin-bottom: 2px;">${item.description}</div>
                ${item.type === 'inventory' ? '<span style="background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">Material</span>' : 
                  item.type === 'staff' ? '<span style="background: #dcfce7; color: #059669; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">Service</span>' : 
                  '<span style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">Custom</span>'}
              </td>
              <td style="padding: 18px 15px; text-align: center; font-size: 14px; color: #475569; font-weight: 600;">${item.quantity}</td>
              <td style="padding: 18px 15px; text-align: right; font-size: 14px; color: #475569; font-weight: 600;">${formatCurrency(item.rate)}</td>
              <td style="padding: 18px 25px; text-align: right; font-size: 15px; font-weight: 700; color: #1e293b;">${formatCurrency(item.amount)}</td>
            </tr>
          `;
        }
      }).join('');
    }).join('');
  }
  
  return '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #64748b;">No items found</td></tr>';
};

// Helper function to calculate total of all items (products or legacy items)
const calculateItemsTotal = (bill: Bill): number => {
  // If bill has products (new structure), use them
  if (bill.products && bill.products.length > 0) {
    return bill.products.reduce((sum, product) => sum + product.total, 0);
  }
  
  // Fall back to legacy items structure
  if (bill.items && bill.items.length > 0) {
    return bill.items.reduce((sum, item) => sum + item.amount, 0);
  }
  
  return 0;
};

const generateProfessionalBillHTML = async (bill: Bill): Promise<string> => {
  // Get company information dynamically
  const { getCompanyInfo } = await import('@/utils/settingsUtils');
  const companyInfo = await getCompanyInfo();
  
  const qrCodeSection = bill.qrCodeUrl ? `
    <div style="text-align: center; margin-top: 25px; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <h4 style="color: #1e293b; margin-bottom: 15px; font-size: 16px; font-weight: 600;">UPI Payment QR Code</h4>
      <div style="background: white; padding: 15px; border-radius: 12px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <img src="${bill.qrCodeUrl}" alt="UPI QR Code" style="width: 140px; height: 140px; border-radius: 8px;">
      </div>
      <p style="font-size: 14px; color: #475569; margin-top: 12px; font-weight: 500;">Scan to pay ${formatCurrency(bill.balance)}</p>
      <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Instant payment via any UPI app</p>
    </div>
  ` : '';

  const paymentRecordsSection = bill.paymentRecords && bill.paymentRecords.length > 0 ? `
    <div style="margin-top: 40px; background: #f8fafc; padding: 30px; border-radius: 16px; border-left: 4px solid #3b82f6;">
      <h3 style="color: #1e293b; margin-bottom: 20px; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
        <span style="background: #3b82f6; color: white; padding: 8px; border-radius: 8px; margin-right: 12px; font-size: 14px;">💳</span>
        Payment History
      </h3>
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white;">
            <th style="padding: 15px; text-align: left; font-size: 14px; font-weight: 600;">Date</th>
            <th style="padding: 15px; text-align: left; font-size: 14px; font-weight: 600;">Payment Type</th>
            <th style="padding: 15px; text-align: right; font-size: 14px; font-weight: 600;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${bill.paymentRecords.map((payment, index) => `
            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 15px; font-size: 13px; color: #475569;">
                ${formatBillDate(payment.paymentDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </td>
              <td style="padding: 12px 15px; font-size: 13px;">
                <span style="background: ${payment.type === 'cash' ? '#10b981' : payment.type === 'online' ? '#3b82f6' : '#8b5cf6'}; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 500; text-transform: uppercase;">
                  ${payment.type === 'split' ? `Split Payment` : payment.type}
                </span>
                ${payment.type === 'split' ? `<br><span style="font-size: 11px; color: #64748b;">Cash: ${formatCurrency(payment.cashAmount || 0)} | Online: ${formatCurrency(payment.onlineAmount || 0)}</span>` : ''}
              </td>
              <td style="padding: 12px 15px; text-align: right; font-size: 13px; font-weight: 600; color: #059669;">
                ${formatCurrency(payment.amount)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  return `
    <div style="font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; max-width: 900px; margin: 0 auto; background: white; line-height: 1.6;">
      <!-- Professional Header with Gradient -->
      <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%); color: white; padding: 40px 30px; position: relative; overflow: hidden;">
        <div style="position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: rgba(255,255,255,0.1); border-radius: 50%; opacity: 0.3;"></div>
        <div style="position: absolute; bottom: -30px; left: -30px; width: 150px; height: 150px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
        
        <div style="relative z-10; display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap;">
          <div>
            <h1 style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 8px;">${companyInfo.name.toUpperCase()}</h1>
            <p style="margin: 0; font-size: 16px; opacity: 0.9; font-weight: 400;">${companyInfo.address}</p>
            <div style="margin-top: 20px; padding: 12px 20px; background: rgba(255,255,255,0.15); border-radius: 25px; backdrop-filter: blur(10px); display: inline-block;">
              <span style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">✨ Professional Invoice</span>
            </div>
          </div>
          <div style="text-align: right; margin-top: 20px;">
            <div style="background: rgba(255,255,255,0.2); padding: 15px 20px; border-radius: 12px; backdrop-filter: blur(10px);">
              <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Number</p>
              <p style="margin: 0; font-size: 20px; font-weight: 700; color: #fbbf24;">${bill.billId}</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Bill Information Cards -->
      <div style="padding: 40px 30px; background: #f8fafc;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
          <!-- Bill Details Card -->
          <div style="background: white; padding: 25px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-left: 4px solid #3b82f6;">
            <h3 style="color: #1e293b; margin-bottom: 20px; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
              <span style="background: #3b82f6; color: white; padding: 8px; border-radius: 8px; margin-right: 12px; font-size: 14px;">📋</span>
              Invoice Details
            </h3>
            <div style="space-y: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="color: #64748b; font-size: 14px;">Invoice Date:</span>
                <span style="color: #1e293b; font-weight: 600; font-size: 14px;">${formatDateForDisplay(bill.date)}</span>
              </div>
              ${bill.dueDate ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="color: #64748b; font-size: 14px;">Due Date:</span>
                  <span style="color: #dc2626; font-weight: 600; font-size: 14px;">${formatDateForDisplay(bill.dueDate)}</span>
                </div>
              ` : ''}
              ${bill.orderId ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="color: #64748b; font-size: 14px;">Order Reference:</span>
                  <span style="color: #7c3aed; font-weight: 600; font-size: 14px;">${bill.orderId}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="color: #64748b; font-size: 14px;">Payment Status:</span>
                <span style="background: ${bill.balance > 0 ? '#fee2e2' : '#dcfce7'}; color: ${bill.balance > 0 ? '#dc2626' : '#059669'}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                  ${bill.balance > 0 ? (bill.paidAmount > 0 ? 'Partially Paid' : 'Unpaid') : 'Paid'}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Customer Details Card -->
          <div style="background: white; padding: 25px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-left: 4px solid #10b981;">
            <h3 style="color: #1e293b; margin-bottom: 20px; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
              <span style="background: #10b981; color: white; padding: 8px; border-radius: 8px; margin-right: 12px; font-size: 14px;">👤</span>
              Customer Information
            </h3>
            <div style="space-y: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="color: #64748b; font-size: 14px;">Name:</span>
                <span style="color: #1e293b; font-weight: 600; font-size: 14px;">${bill.customerName}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="color: #64748b; font-size: 14px;">Phone:</span>
                <span style="color: #1e293b; font-weight: 600; font-size: 14px;">${bill.customerPhone}</span>
              </div>
              ${bill.customerEmail ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="color: #64748b; font-size: 14px;">Email:</span>
                  <span style="color: #1e293b; font-weight: 600; font-size: 14px;">${bill.customerEmail}</span>
                </div>
              ` : ''}
              ${bill.customerAddress ? `
                <div style="padding: 8px 0;">
                  <span style="color: #64748b; font-size: 14px; display: block; margin-bottom: 4px;">Address:</span>
                  <span style="color: #1e293b; font-weight: 500; font-size: 14px; line-height: 1.5;">${bill.customerAddress}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <!-- Premium Items Table -->
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 30px;">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 20px 25px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
              <span style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 8px; margin-right: 12px; font-size: 14px;">🛍️</span>
              ${bill.products && bill.products.length > 0 ? 'Products & Services' : 'Service Details'}
            </h3>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);">
                <th style="padding: 18px 15px; text-align: center; font-weight: 600; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; width: 60px;">S.No</th>
                <th style="padding: 18px 20px; text-align: left; font-weight: 600; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; width: 150px;">Product</th>
                <th style="padding: 18px 25px; text-align: left; font-weight: 600; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
                <th style="padding: 18px 15px; text-align: center; font-weight: 600; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; width: 80px;">Qty</th>
                <th style="padding: 18px 15px; text-align: right; font-weight: 600; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; width: 120px;">Rate</th>
                <th style="padding: 18px 25px; text-align: right; font-weight: 600; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; width: 120px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${generateItemsTableRows(bill)}
              <tr style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-top: 2px solid #3b82f6;">
                <td colspan="5" style="padding: 18px 25px; font-weight: 700; font-size: 16px; color: #1e293b;">Items Subtotal</td>
                <td style="padding: 18px 25px; text-align: right; font-weight: 700; font-size: 16px; color: #3b82f6;">
                  ${formatCurrency(calculateItemsTotal(bill))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Enhanced Bill Summary -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
          <div style="width: 400px; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.15); border-left: 6px solid #3b82f6;">
           <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 20px 25px;">
              <h3 style="margin: 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
                <span style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 8px; margin-right: 12px; font-size: 14px;">💰</span>
                Invoice Summary
              </h3>
            </div>
            <div style="padding: 25px;">
              <div style="space-y: 15px;">
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="font-size: 14px; color: #64748b;">Subtotal</span>
                  <span style="font-size: 15px; font-weight: 600; color: #1e293b;">${formatCurrency(bill.subtotal)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="font-size: 14px; color: #64748b;">GST (${bill.gstPercent}%)</span>
                  <span style="font-size: 15px, font-weight: 600; color: #1e293b;">${formatCurrency(bill.gstAmount)}</span>
                </div>
                ${bill.discount > 0 ? `
                  <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 14px; color: #64748b;">Discount</span>
                    <span style="font-size: 15px; font-weight: 600; color: #059669;">-${formatCurrency(bill.discount)}</span>
                  </div>
                ` : ''}
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); margin: 15px -25px; padding: 15px 25px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 18px; font-weight: 700; color: #1e293b;">Total Amount</span>
                    <span style="font-size: 20px; font-weight: 800; color: #3b82f6;">${formatCurrency(bill.totalAmount)}</span>
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="font-size: 14px; color: #64748b;">Amount Paid</span>
                  <span style="font-size: 15px; font-weight: 600; color: #059669;">${formatCurrency(bill.paidAmount)}</span>
                </div>
                <div style="background: ${bill.balance > 0 ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' : 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'}; margin: 15px -25px; padding: 15px 25px; border-radius: 0 0 16px 16px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 18px; font-weight: 700; color: #1e293b;">Balance Due</span>
                    <span style="font-size: 20px; font-weight: 800; color: ${bill.balance > 0 ? '#dc2626' : '#059669'};">${formatCurrency(bill.balance)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${paymentRecordsSection}
        
        <!-- Payment Information Section -->
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 35px; border-radius: 20px; margin-bottom: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <h3 style="color: #1e293b; margin-bottom: 25px; font-size: 20px; text-align: center; font-weight: 700;">💳 Payment Methods</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
            <!-- Bank Transfer Card -->
            <div style="background: white; padding: 25px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-left: 4px solid #059669;">
              <h4 style="color: #059669; margin-bottom: 18px; font-size: 16px; font-weight: 600; display: flex; align-items: center;">
                <span style="background: #059669; color: white; padding: 6px; border-radius: 6px; margin-right: 10px; font-size: 12px;">🏦</span>
                Bank Transfer
              </h4>
              <div style="space-y: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
                  <span style="color: #64748b; font-size: 13px;">Account Name:</span>
                  <span style="color: #1e293b; font-weight: 600; font-size: 13px;">${bill.bankDetails.accountName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
                  <span style="color: #64748b; font-size: 13px;">Account Number:</span>
                  <span style="color: #1e293b; font-weight: 600; font-size: 13px; font-family: monospace;">${bill.bankDetails.accountNumber}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
                  <span style="color: #64748b; font-size: 13px;">IFSC Code:</span>
                  <span style="color: #1e293b; font-weight: 600; font-size: 13px; font-family: monospace;">${bill.bankDetails.ifsc}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                  <span style="color: #64748b; font-size: 13px;">Bank Name:</span>
                  <span style="color: #1e293b; font-weight: 600; font-size: 13px;">${bill.bankDetails.bankName}</span>
                </div>
              </div>
            </div>
            
            <!-- UPI Payment Card -->
            <div style="background: white; padding: 25px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-left: 4px solid #7c3aed; text-align: center;">
              <h4 style="color: #7c3aed; margin-bottom: 18px; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center;">
                <span style="background: #7c3aed; color: white; padding: 6px; border-radius: 6px; margin-right: 10px; font-size: 12px;">📱</span>
                UPI Payment
              </h4>
              <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                <p style="margin: 0; font-size: 13px; color: #64748b;">UPI ID:</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: 600; color: #1e293b; font-family: monospace;">${bill.upiId}</p>
              </div>
              ${qrCodeSection}
            </div>
          </div>
        </div>
        
        <!-- Professional Footer -->
        <div style="text-align: center; padding: 35px 0; border-top: 3px solid #e2e8f0; margin-top: 40px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);">
          <div style="margin-bottom: 20px;">
            <h4 style="color: #3b82f6; font-size: 18px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; justify-content: center;">
              <span style="margin-right: 8px;">✨</span>
              Thank you for choosing ${companyInfo.name}!
              <span style="margin-left: 8px;">✨</span>
            </h4>
            <p style="color: #64748b; font-size: 14px; margin: 0;">We appreciate your trust in our premium tailoring services</p>
          </div>
          
          <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin: 20px auto; max-width: 600px;">
            <p style="color: #475569; font-size: 13px; margin: 0 0 8px 0; font-weight: 500;">Payment Terms & Conditions:</p>
            <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.6;">
              • Payment is due within 7 days from invoice date<br>
              • Late payments may incur additional charges<br>
              • For any queries, please contact us immediately<br>
              • All custom work is subject to our terms of service
            </p>
          </div>
          
          ${bill.notes ? `
            <div style="background: #fffbeb; border: 1px solid #fed7aa; padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 600px;">
              <p style="color: #92400e; font-size: 13px; margin: 0; font-weight: 500;"><strong>Special Notes:</strong></p>
              <p style="color: #b45309; font-size: 12px; margin: 5px 0 0 0; line-height: 1.5; font-style: italic;">${bill.notes}</p>
            </div>
          ` : ''}
          
          <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
              This is a computer-generated invoice. For authenticity verification, please contact ${companyInfo.name} directly.
            </p>
          </div>
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

export const printBill = async (bill: Bill) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Unable to open print window. Please check your popup blocker.');
  }

  // Get company information dynamically
  const { getCompanyInfo } = await import('@/utils/settingsUtils');
  const companyInfo = await getCompanyInfo();

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${bill.billId} - ${companyInfo.name}</title>
      <style>
        @page {
          margin: 15mm;
          size: A4 portrait;
        }
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none; }
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11pt;
          line-height: 1.2;
          color: #333;
          margin: 0;
          padding: 0;
          background: white;
        }
      </style>
    </head>
    <body>
      ${await generateZylkerStyleBillHTML(bill)}
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

// Helper function to generate Zylker-style table rows for both products and legacy items structure
const generateZylkerItemsTableRows = (bill: Bill): string => {
  let productCounter = 0;
  
  // If bill has products (new structure), use them
  if (bill.products && bill.products.length > 0) {
    return bill.products.map(product => {
      const descriptions = product.descriptions || [];
      if (descriptions.length === 0) return '';
      
      // Increment product counter only once per product
      productCounter++;
      
      return descriptions.map((desc, index) => {
        const bgColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
        
        if (index === 0) {
          // First row includes product name with rowSpan and the S.No
          return `
            <tr style="background: ${bgColor}; border-bottom: 0.5pt solid #e1e5e9;">
              <td style="padding: 6pt; text-align: center; font-weight: bold; color: #666; width: 5%;" rowspan="${descriptions.length}">${productCounter}</td>
              <td style="padding: 6pt; vertical-align: top; font-weight: bold; color: #2c3e50; border-right: 0.5pt solid #e1e5e9; width: 20%;" rowspan="${descriptions.length}">
                ${product.name}
              </td>
              <td style="padding: 6pt; vertical-align: top; width: 40%;">
                <div style="font-weight: bold; color: #2c3e50; font-size: 10pt;">${desc.description}</div>
              </td>
              <td style="padding: 6pt; text-align: center; font-weight: bold; font-size: 10pt; width: 10%;">${desc.qty}</td>
              <td style="padding: 6pt; text-align: right; font-weight: bold; font-size: 10pt; width: 10%;">${formatCurrency(desc.rate)}</td>
              <td style="padding: 6pt; text-align: right; font-weight: bold; color: #2c3e50; font-size: 10pt; width: 15%;">${formatCurrency(desc.amount)}</td>
            </tr>
          `;
        } else {
          // Subsequent rows don't include S.No and product name (covered by rowSpan)
          return `
            <tr style="background: ${bgColor}; border-bottom: 0.5pt solid #e1e5e9;">
              <td style="padding: 6pt; vertical-align: top; width: 40%;">
                <div style="font-weight: bold; color: #2c3e50; font-size: 10pt;">${desc.description}</div>
              </td>
              <td style="padding: 6pt; text-align: center; font-weight: bold; font-size: 10pt; width: 10%;">${desc.qty}</td>
              <td style="padding: 6pt; text-align: right; font-weight: bold; font-size: 10pt; width: 10%;">${formatCurrency(desc.rate)}</td>
              <td style="padding: 6pt; text-align: right; font-weight: bold; color: #2c3e50; font-size: 10pt; width: 15%;">${formatCurrency(desc.amount)}</td>
            </tr>
          `;
        }
      }).join('');
    }).join('');
  }
  
  // Fall back to legacy items structure
  if (bill.items && bill.items.length > 0) {
    // Group legacy items by a default product name or try to extract product info
    const groupedItems: { [key: string]: typeof bill.items } = {};
    
    bill.items.forEach(item => {
      // Try to extract product name from description or use item type as grouping
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
    
    return Object.entries(groupedItems).map(([productName, items], groupIndex) => {
      // Increment product counter for each group
      productCounter++;
      
      return items.map((item, index) => {
        const bgColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
        
        if (index === 0) {
          // First row includes product name with rowSpan and the S.No
          return `
            <tr style="background: ${bgColor}; border-bottom: 0.5pt solid #e1e5e9;">
              <td style="padding: 6pt; text-align: center; font-weight: bold; color: #666; width: 5%;" rowspan="${items.length}">${productCounter}</td>
              <td style="padding: 6pt; vertical-align: top; font-weight: bold; color: #2c3e50; border-right: 0.5pt solid #e1e5e9; width: 20%;" rowspan="${items.length}">
                ${productName}
              </td>
              <td style="padding: 6pt; vertical-align: top; width: 40%;">
                <div style="font-weight: bold; color: #2c3e50; font-size: 10pt;">${item.description}</div>
                <div style="font-size: 9pt; color: #888; font-weight: normal; line-height: 1.2;">
                  ${item.type === 'inventory' ? 'Material Item' : 
                    item.type === 'staff' ? 'Service Item' : 'Custom Work'}
                </div>
              </td>
              <td style="padding: 6pt; text-align: center; font-weight: bold; font-size: 10pt; width: 10%;">${item.quantity}</td>
              <td style="padding: 6pt; text-align: right; font-weight: bold; font-size: 10pt; width: 10%;">${formatCurrency(item.rate)}</td>
              <td style="padding: 6pt; text-align: right; font-weight: bold; color: #2c3e50; font-size: 10pt; width: 15%;">${formatCurrency(item.amount)}</td>
            </tr>
          `;
        } else {
          // Subsequent rows don't include S.No and product name (covered by rowSpan)
          return `
            <tr style="background: ${bgColor}; border-bottom: 0.5pt solid #e1e5e9;">
              <td style="padding: 6pt; vertical-align: top; width: 40%;">
                <div style="font-weight: bold; color: #2c3e50; font-size: 10pt;">${item.description}</div>
                <div style="font-size: 9pt; color: #888; font-weight: normal; line-height: 1.2;">
                  ${item.type === 'inventory' ? 'Material Item' : 
                    item.type === 'staff' ? 'Service Item' : 'Custom Work'}
                </div>
              </td>
              <td style="padding: 6pt; text-align: center; font-weight: bold; font-size: 10pt; width: 10%;">${item.quantity}</td>
              <td style="padding: 6pt; text-align: right; font-weight: bold; font-size: 10pt; width: 10%;">${formatCurrency(item.rate)}</td>
              <td style="padding: 6pt; text-align: right; font-weight: bold; color: #2c3e50; font-size: 10pt; width: 15%;">${formatCurrency(item.amount)}</td>
            </tr>
          `;
        }
      }).join('');
    }).join('');
  }
  
  return '<tr><td colspan="5" style="padding: 20pt; text-align: center; color: #666;">No items found</td></tr>';
};

/**
 * Generate Zylker Electronics Hub style invoice HTML - A4 Portrait Optimized
 */
const generateZylkerStyleBillHTML = async (bill: Bill): Promise<string> => {
  // Format dates
  const invoiceDate = formatDateForDisplay(bill.date);
  
  const dueDate = bill.dueDate ? formatDateForDisplay(bill.dueDate)
  : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Get company information dynamically from settings
  const { getCompanyInfo } = await import('@/utils/settingsUtils');
  const companyInfo = await getCompanyInfo();

  // Fetch customer shipping address from customers table
  let customerShippingInfo = {
    name: bill.customerName,
    address: bill.customerAddress || '',
    city: '',
    pincode: '',
    phone: bill.customerPhone,
    email: bill.customerEmail || ''
  };

  try {
    if (bill.customerId) {
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const customerDoc = await getDoc(doc(db, 'customers', bill.customerId));
      if (customerDoc.exists()) {
        const customerData = customerDoc.data();
        customerShippingInfo = {
          name: customerData.name || bill.customerName,
          address: customerData.address || bill.customerAddress || '',
          city: customerData.city || '',
          pincode: customerData.pincode || '',
          phone: customerData.phone || bill.customerPhone,
          email: customerData.email || bill.customerEmail || ''
        };
      }
    } else if (bill.customerName) {
      // If no customerId, try to find by name
      const { getDocs, query, collection, where } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const customersQuery = query(
        collection(db, 'customers'),
        where('name', '==', bill.customerName)
      );
      const querySnapshot = await getDocs(customersQuery);
      
      if (!querySnapshot.empty) {
        const customerData = querySnapshot.docs[0].data();
        customerShippingInfo = {
          name: customerData.name || bill.customerName,
          address: customerData.address || bill.customerAddress || '',
          city: customerData.city || '',
          pincode: customerData.pincode || '',
          phone: customerData.phone || bill.customerPhone,
          email: customerData.email || bill.customerEmail || ''
        };
      }
    }
  } catch (error) {
    console.warn('Could not fetch customer shipping details, using bill data:', error);
  }

  return `
    <div style="width: 180mm; margin: 0 auto; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.4; color: #333; background: white; box-sizing: border-box;">
      
      <!-- Outer Border Frame -->
      <div style="border: 0.5pt solid #000; position: relative; margin: 0; padding: 0;">
        
        <!-- Header Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 15mm 15mm 10mm 15mm; border-bottom: 0.5pt solid #ddd;">
          
          <!-- Company Info (Top-Left) -->
          <div style="flex: 1; padding-right: 20mm;">
            <h1 style="margin: 0 0 6pt 0; font-size: 24pt; font-weight: bold; color: #2c3e50; letter-spacing: -0.5pt;">${companyInfo.name.toUpperCase()}</h1>
            <div style="font-size: 12pt; color: #666; line-height: 1.4;">
              ${companyInfo.address ? `<div>${companyInfo.address}</div>` : ''}
              ${companyInfo.city ? `<div style="margin-top: 2pt;">${companyInfo.city}</div>` : ''}
              ${companyInfo.phone ? `<div style="margin-top: 2pt;">Phone: ${companyInfo.phone}</div>` : ''}
              ${companyInfo.email ? `<div>Email: ${companyInfo.email}</div>` : ''}
              ${companyInfo.taxNumber ? `<div style="margin-top: 2pt; font-weight: bold;">Tax No: ${companyInfo.taxNumber}</div>` : ''}
            </div>
          </div>
          
          <!-- Invoice Title & Accent (Top-Right) -->
          <div style="text-align: right; position: relative; flex-shrink: 0;">
            <!-- Light decorative accent -->
            <div style="position: absolute; top: -5pt; right: -5pt; width: 60pt; height: 60pt; background: linear-gradient(45deg, #3498db, #2980b9); opacity: 0.15; border-radius: 50%; z-index: 0;"></div>
            <h2 style="margin: 0; font-size: 32pt; font-weight: bold; color: #2c3e50; position: relative; z-index: 1; letter-spacing: 1pt;">INVOICE</h2>
          </div>
        </div>
        
        <!-- Invoice Metadata Grid -->
        <div style="display: flex; margin-bottom: 15mm; border-bottom: 0.5pt solid #ddd;">
          <!-- Left Cell (Light Gray Background) -->
          <div style="flex: 1; padding: 12pt 15mm; background: #f5f5f5; border-right: 0.5pt solid #ddd;">
            <div style="margin-bottom: 6pt; font-size: 11pt;">
              <span style="font-weight: normal; color: #555;">Invoice #</span>
              <span style="font-weight: bold; margin-left: 8pt;">${bill.billId}</span>
            </div>
            <div style="margin-bottom: 6pt; font-size: 11pt;">
              <span style="font-weight: normal; color: #555;">Invoice Date</span>
              <span style="font-weight: bold; margin-left: 8pt;">${invoiceDate}</span>
            </div>
            <div style="margin-bottom: 6pt; font-size: 11pt;">
              <span style="font-weight: normal; color: #555;">Terms</span>
              <span style="font-weight: bold; margin-left: 8pt;">Net 7 Days</span>
            </div>
            <div style="font-size: 11pt;">
              <span style="font-weight: normal; color: #555;">Due Date</span>
              <span style="font-weight: bold; margin-left: 8pt;">${dueDate}</span>
            </div>
          </div>
          <!-- Right Cell (Reserved/Blank) -->
          <div style="flex: 1; padding: 12pt 15mm;"></div>
        </div>
        
        <!-- Bill To / Ship To Section -->
        <div style="display: flex; margin-bottom: 15mm; border-bottom: 0.5pt solid #ddd;">
          <!-- Bill To -->
          <div style="flex: 1; padding: 12pt 15mm; border-right: 0.5pt solid #ddd;">
            <div style="background: #f5f5f5; padding: 3pt 6pt; margin-bottom: 6pt; font-size: 10pt; font-weight: bold; text-transform: uppercase; color: #666; border: 0.5pt solid #ddd;">BILL TO</div>
            <div style="font-size: 14pt; font-weight: bold; color: #2c3e50; margin-bottom: 3pt;">${bill.customerName}</div>
            <div style="font-size: 12pt; color: #666; line-height: 1.4;">
              <div>Phone: ${bill.customerPhone}</div>
              ${bill.customerEmail ? `<div>Email: ${bill.customerEmail}</div>` : ''}
              ${bill.customerAddress ? `<div style="margin-top: 3pt;">${bill.customerAddress}</div>` : ''}
            </div>
          </div>
          <!-- Ship To -->
          <div style="flex: 1; padding: 12pt 15mm;">
            <div style="background: #f5f5f5; padding: 3pt 6pt; margin-bottom: 6pt; font-size: 10pt; font-weight: bold; text-transform: uppercase; color: #666; border: 0.5pt solid #ddd;">SHIP TO</div>
            <div style="font-size: 14pt; font-weight: bold; color: #2c3e50; margin-bottom: 3pt;">${customerShippingInfo.name}</div>
            <div style="font-size: 12pt; color: #666; line-height: 1.4;">
              ${customerShippingInfo.address || customerShippingInfo.city || customerShippingInfo.pincode ? `
                ${customerShippingInfo.address ? `<div>${customerShippingInfo.address}</div>` : ''}
                ${customerShippingInfo.city || customerShippingInfo.pincode ? `<div>${customerShippingInfo.city}${customerShippingInfo.city && customerShippingInfo.pincode ? ' - ' : ''}${customerShippingInfo.pincode}</div>` : ''}
              ` : '<div>Same as billing address</div>'}
            </div>
          </div>
        </div>
        
        <!-- Items Table -->
        <div style="margin-bottom: 15mm; padding: 0 15mm;">
          <table style="width: 100%; border-collapse: collapse; font-size: 11pt;">
            <thead>
              <tr style="background: #2c3e50; color: white;">
                <th style="padding: 6pt; text-align: center; font-weight: bold; font-size: 11pt; width: 5%;">#</th>
                <th style="padding: 6pt; text-align: left; font-weight: bold; font-size: 11pt; width: 20%;">Product</th>
                <th style="padding: 6pt; text-align: left; font-weight: bold; font-size: 11pt; width: 40%;">Description</th>
                <th style="padding: 6pt; text-align: center; font-weight: bold; font-size: 11pt; width: 10%;">Qty</th>
                <th style="padding: 6pt; text-align: right; font-weight: bold; font-size: 11pt; width: 10%;">Rate</th>
                <th style="padding: 6pt; text-align: right; font-weight: bold; font-size: 11pt; width: 15%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${generateZylkerItemsTableRows(bill)}
            </tbody>
          </table>
        </div>
        
        <!-- Sub-Total & Totals Section -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 15mm; padding: 0 15mm;">
          <div style="display: flex; align-items: flex-start; gap: 20mm;">
            <!-- Sub Total -->
            <div style="padding: 10pt 15pt; background: #f8f9fa; border: 0.5pt solid #e1e5e9; border-radius: 3pt; text-align: right;">
              <div style="font-size: 12pt; font-weight: bold; color: #2c3e50;">
                Sub Total
              </div>
              <div style="font-size: 14pt; font-weight: bold; color: #2c3e50; margin-top: 2pt;">
                ${formatCurrency(bill.subtotal)}
              </div>
            </div>
            
            <!-- Totals Box (Light Blue) -->
            <div style="background: #e3f2fd; padding: 12pt 15pt; border-radius: 3pt; border: 0.5pt solid #bbdefb; min-width: 50mm;">
              <div style="margin-bottom: 6pt; display: flex; justify-content: space-between; font-size: 11pt;">
                <span style="color: #555;">Tax Rate</span>
                <span style="font-weight: bold;">${bill.gstPercent.toFixed(2)}%</span>
              </div>
              ${bill.discount > 0 ? `
                <div style="margin-bottom: 6pt; display: flex; justify-content: space-between; font-size: 11pt;">
                  <span style="color: #555;">Discount</span>
                  <span style="font-weight: bold; color: #e74c3c;">-${formatCurrency(bill.discount)}</span>
                </div>
              ` : ''}
              <div style="margin-bottom: 6pt; display: flex; justify-content: space-between; padding-top: 6pt; border-top: 0.5pt solid #90caf9; font-size: 11pt;">
                <span style="font-weight: bold; color: #2c3e50;">Total</span>
                <span style="font-weight: bold; color: #2c3e50;">${formatCurrency(bill.totalAmount)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding-top: 6pt; border-top: 1pt solid #1976d2; font-size: 12pt;">
                <span style="font-weight: bold; color: #1976d2;">Balance Due</span>
                <span style="font-weight: bold; color: #1976d2;">${formatCurrency(bill.balance)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Terms & Conditions Block -->
        <div style="margin-bottom: 15mm; padding: 0 15mm;">
          <div style="background: #f8f9fa; padding: 10pt 12pt; border: 0.5pt solid #e1e5e9; border-radius: 3pt;">
            <h3 style="margin: 0 0 6pt 0; font-size: 12pt; font-weight: bold; color: #2c3e50;">Terms & Conditions</h3>
            <div style="font-size: 10pt; color: #666; line-height: 1.4;">
              <div>• Payment is due within 7 days from invoice date</div>
              <div>• Late payments may incur additional charges</div>
              <div>• All custom work is subject to our terms of service</div>
              <div>• For any queries, please contact us immediately</div>
            </div>
          </div>
        </div>
        
        <!-- Notes & QR Code Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 0 15mm; margin-bottom: 20mm;">
          <div style="flex: 1; padding-right: 15mm;">
            ${bill.notes ? `
              <div style="background: #fff9c4; border: 0.5pt solid #ffeaa7; padding: 10pt; border-radius: 3pt;">
                <div style="font-weight: bold; color: #856404; margin-bottom: 3pt; font-size: 12pt;">Special Notes</div>
                <div style="font-size: 10pt; color: #856404; line-height: 1.4;">${bill.notes}</div>
              </div>
            ` : ''}
          </div>
          
          <!-- QR Code Section (60 × 60 mm) -->
          ${bill.qrCodeUrl && bill.balance > 0 ? `
            <div style="text-align: center; padding: 10pt; background: #f8f9fa; border: 0.5pt solid #e1e5e9; border-radius: 3pt; flex-shrink: 0;">
              <div style="margin-bottom: 6pt;">
                <img src="${bill.qrCodeUrl}" alt="UPI QR Code" style="width: 60mm; height: 60mm; border-radius: 3pt; border: 0.5pt solid #ddd; display: block;">
              </div>
              <div style="font-size: 10pt; font-weight: bold; color: #2c3e50; line-height: 1.2;">
                Scan to Pay ${formatCurrency(bill.balance)}
              </div>
            </div>
          ` : ''}
        </div>
        
        <!-- Footer -->
        <div style="position: absolute; bottom: 0; left: 0; right: 0; text-align: center; padding: 10pt; background: #f8f9fa; border-top: 0.5pt solid #e1e5e9; font-size: 9pt; color: #666;">
          <div style="margin-bottom: 2pt;">Thank you for choosing ${companyInfo.name} - Premium Tailoring Excellence</div>
          <div>This is a computer-generated invoice. No signature required.</div>
        </div>
      </div>
    </div>
  `;
};
