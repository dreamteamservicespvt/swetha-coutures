
import { getCompanyInfo } from './settingsUtils';

export const generateWhatsAppLink = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
};

export const generateCallLink = (phone: string) => {
  return `tel:${phone}`;
};

export const getOrderStatusMessage = async (customerName: string, orderId: string, status: string) => {
  const companyInfo = await getCompanyInfo();
  return `Hi ${customerName}, your order #${orderId} status has been updated to: ${status}. Thank you for choosing ${companyInfo.name}!`;
};

export const getAppointmentReminderMessage = async (customerName: string, date: string, time: string) => {
  const companyInfo = await getCompanyInfo();
  return `Hi ${customerName}, this is a reminder for your appointment at ${companyInfo.name} on ${date} at ${time}. We look forward to seeing you!`;
};

export const getPaymentReminderMessage = async (customerName: string, amount: number, orderId: string) => {
  const companyInfo = await getCompanyInfo();
  return `Hi ${customerName}, your order #${orderId} is ready for delivery. Pending payment: ₹${amount}. Please contact us to arrange payment and delivery.`;
};
