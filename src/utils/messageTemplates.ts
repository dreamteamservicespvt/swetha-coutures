import { getCompanyInfo } from './settingsUtils';

/**
 * Generate dynamic contact message for customers
 */
export const getCustomerContactMessage = async (customerName: string) => {
  const companyInfo = await getCompanyInfo();
  return `Hi ${customerName}, thank you for choosing ${companyInfo.name}! How can we assist you today?`;
};

/**
 * Generate dynamic order status message
 */
export const getOrderStatusMessage = async (customerName: string, orderId: string, status: string) => {
  const companyInfo = await getCompanyInfo();
  return `Hi ${customerName}, your order #${orderId} status has been updated to: ${status}. Thank you for choosing ${companyInfo.name}!`;
};

/**
 * Generate dynamic appointment reminder message
 */
export const getAppointmentReminderMessage = async (customerName: string, date: string, time: string) => {
  const companyInfo = await getCompanyInfo();
  return `Hi ${customerName}, this is a reminder for your appointment at ${companyInfo.name} on ${date} at ${time}. We look forward to seeing you!`;
};

/**
 * Generate dynamic welcome message template
 */
export const getWelcomeMessageTemplate = async (customerName: string, customerPhone: string, customerType: string, totalOrders: number, totalSpent: number) => {
  const companyInfo = await getCompanyInfo();
  
  return `Dear ${customerName},

Welcome to ${companyInfo.name}! We're delighted to have you as our valued customer.

CUSTOMER DETAILS:
━━━━━━━━━━━━━━━━━━━━
• Name: ${customerName}
• Phone: ${customerPhone}
• Customer Type: ${customerType}
• Total Orders: ${totalOrders}
• Total Spent: ₹${totalSpent}

We specialize in creating beautiful, custom garments tailored to your unique style and preferences. Our skilled artisans are committed to delivering exceptional quality and service.

For any inquiries or to place a new order, please don't hesitate to contact us.

Thank you for choosing ${companyInfo.name}!

Best regards,
${companyInfo.name} Team`;
};

/**
 * Generate dynamic follow-up message template
 */
export const getFollowUpMessageTemplate = async (customerName: string, customerType: string, totalOrders: number, lastOrderDate: string) => {
  const companyInfo = await getCompanyInfo();
  
  return `Dear ${customerName},

We hope you're doing well! We wanted to follow up and see how you're enjoying your recent purchase from ${companyInfo.name}.

YOUR PROFILE:
━━━━━━━━━━━━━━━━━━━━
• Customer Since: Your first order
• Total Orders: ${totalOrders}
• Customer Type: ${customerType}
• Last Order: ${lastOrderDate}

Your satisfaction is our priority, and we'd love to hear your feedback about our products and services.

If you have any questions, need alterations, or are interested in placing a new order, please let us know!

Thank you for being a valued customer.

Best regards,
${companyInfo.name} Team`;
};

/**
 * Generate dynamic new collection alert template
 */
export const getNewCollectionTemplate = async (customerName: string, customerType: string) => {
  const companyInfo = await getCompanyInfo();
  
  return `Dear ${customerName},

Exciting news! We've just launched our new collection at ${companyInfo.name}, and we thought you'd love to see what we have in store.

SPECIAL OFFER FOR YOU:
━━━━━━━━━━━━━━━━━━━━
• Customer Type: ${customerType}
• Exclusive Preview Access
• Special Discounts Available
• Custom Fitting Consultation

Our new collection features:
✨ Latest fashion trends
✨ Premium quality fabrics
✨ Custom tailoring options
✨ Unique designs

As one of our ${customerType} customers, you get early access to our new pieces. Visit us for a personalized consultation and fitting.

Book your appointment today!

Best regards,
${companyInfo.name} Team`;
};

/**
 * Generate dynamic bulk WhatsApp message templates
 */
export const getBulkWhatsAppTemplates = async () => {
  const companyInfo = await getCompanyInfo();
  
  return {
    'general-greeting': `Hi! 👋

Thank you for choosing ${companyInfo.name}! We have exciting updates and offers for you.

We appreciate your continued trust in our services and look forward to serving you again soon! ✨

Best regards,
${companyInfo.name} Team`,

    'new-collection': `🌟 NEW COLLECTION ALERT! 🌟

Dear Valued Customer,

We're thrilled to announce our latest collection at ${companyInfo.name}! 

✨ Latest Fashion Trends
🪡 Premium Quality Fabrics  
👗 Custom Designs Available
🎨 Professional Tailoring

Visit us today to explore our stunning new arrivals!

Best regards,
${companyInfo.name} Team`,

    'special-offer': `🎉 SPECIAL OFFER JUST FOR YOU! 🎉

Dear Customer,

We have an exclusive offer waiting for you at ${companyInfo.name}:

🔥 Special Discount Available
💎 Premium Services
🚀 Quick Turnaround Time
✅ 100% Satisfaction Guaranteed

Don't miss out on this limited-time offer!

Contact us today!

${companyInfo.name} Team`,

    'appointment-reminder': `📅 APPOINTMENT REMINDER

Hello!

This is a friendly reminder about our services at ${companyInfo.name}.

We're here to help you with:
• Custom Tailoring
• Design Consultations
• Alterations
• Premium Fabrics

Book your appointment today for personalized service!

Best regards,
${companyInfo.name} Team`,

    'festival-wishes': `🎊 FESTIVAL GREETINGS! 🎊

Dear Customer,

Wishing you and your family a very happy and prosperous festival season!

Make this celebration special with our:
✨ Festival Collection
🌺 Traditional Wear
👑 Ethnic Designs
🎨 Custom Creations

Let us help you look your best for the festivities!

With warm wishes,
${companyInfo.name} Team`,

    'thank-you': `💜 THANK YOU! 💜

Dear Valued Customer,

Thank you for choosing ${companyInfo.name} for your tailoring needs!

Your trust in our services means the world to us. We're committed to providing you with:

🌟 Exceptional Quality
⚡ Timely Delivery  
💎 Premium Service
😊 Customer Satisfaction

We look forward to serving you again!

With gratitude,
${companyInfo.name} Team`
  };
};

/**
 * Generate dynamic order WhatsApp message templates
 */
export const getOrderWhatsAppTemplates = async (orderNumber: string, customerName: string, itemType: string, orderDate: string, deliveryDate: string, totalAmount: number, balance: number, status: string) => {
  const companyInfo = await getCompanyInfo();
  
  return {
    'order-confirmation': `Dear ${customerName},

We are pleased to acknowledge receipt of your order #${orderNumber} at ${companyInfo.name}.

ORDER DETAILS:
━━━━━━━━━━━━━━━━━━━━
• Order Number: ${orderNumber}
• Item Type: ${itemType}
• Order Date: ${orderDate}
• Expected Delivery: ${deliveryDate}
• Total Amount: ₹${totalAmount}
• Current Status: ${status}

We are committed to delivering exceptional quality and service. Our team will begin working on your order shortly, and we will keep you informed of the progress.

Should you have any questions or concerns, please do not hesitate to contact us.

Thank you for choosing ${companyInfo.name}.

Best regards,
${companyInfo.name} Team`,

    'status-update': `Dear ${customerName},

We would like to update you on the progress of your order #${orderNumber}.

STATUS UPDATE:
━━━━━━━━━━━━━━━━━━━━
• Order Number: ${orderNumber}
• Current Status: ${status}
• Item Type: ${itemType}
• Expected Delivery: ${deliveryDate}

We are working diligently to ensure your order meets our high standards of quality. We will continue to keep you informed of any further developments.

Thank you for your patience and for choosing ${companyInfo.name}.

Best regards,
${companyInfo.name} Team`,

    'payment-reminder': `Dear ${customerName},

We hope this message finds you well. We would like to bring to your attention the outstanding balance for your order.

PAYMENT DETAILS:
━━━━━━━━━━━━━━━━━━━━
• Order Number: ${orderNumber}
• Total Amount: ₹${totalAmount}
• Outstanding Balance: ₹${balance}
• Item Type: ${itemType}

We kindly request you to arrange payment at your earliest convenience. Your prompt attention to this matter would be greatly appreciated.

Thank you for your cooperation and for choosing ${companyInfo.name}.

Best regards,
${companyInfo.name} Team`,

    'ready-notification': `Dear ${customerName},

We are delighted to inform you that your order #${orderNumber} has been completed and is ready for collection.

COLLECTION DETAILS:
━━━━━━━━━━━━━━━━━━━━
• Order Number: ${orderNumber}
• Item Type: ${itemType}
• Status: Ready for Pickup
• Outstanding Balance: ₹${balance}

Please visit us at your convenience during our business hours to collect your order. We trust that you will be pleased with the quality of our work.

Thank you for choosing ${companyInfo.name}.

Best regards,
${companyInfo.name} Team`,

    'delivery-confirmation': `Dear ${customerName},

We are pleased to confirm that your order #${orderNumber} has been successfully delivered.

DELIVERY CONFIRMATION:
━━━━━━━━━━━━━━━━━━━━
• Order Number: ${orderNumber}
• Item Type: ${itemType}
• Delivery Status: Completed
• Delivery Date: ${orderDate}

We trust that you are completely satisfied with your order. It has been our pleasure to serve you, and we look forward to your continued patronage.

Thank you for choosing ${companyInfo.name}.

Best regards,
${companyInfo.name} Team`
  };
};
