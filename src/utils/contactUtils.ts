
export const generateWhatsAppLink = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
};

export const generateCallLink = (phone: string) => {
  return `tel:${phone}`;
};

export const getOrderStatusMessage = (customerName: string, orderId: string, status: string) => {
  return `Hi ${customerName}, your order #${orderId} status has been updated to: ${status}. Thank you for choosing Swetha's Couture!`;
};

export const getAppointmentReminderMessage = (customerName: string, date: string, time: string) => {
  return `Hi ${customerName}, this is a reminder for your appointment at Swetha's Couture on ${date} at ${time}. We look forward to seeing you!`;
};

export const getPaymentReminderMessage = (customerName: string, amount: number, orderId: string) => {
  return `Hi ${customerName}, your order #${orderId} is ready for delivery. Pending payment: ₹${amount}. Please contact us to arrange payment and delivery.`;
};
