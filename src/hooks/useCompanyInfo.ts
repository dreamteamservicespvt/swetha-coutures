import { useState, useEffect } from 'react';
import { getCompanyInfo } from '@/utils/settingsUtils';

interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  taxNumber: string;
  fullAddress: string;
}

/**
 * Hook to get dynamic company information
 */
export const useCompanyInfo = () => {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        setLoading(true);
        const info = await getCompanyInfo();
        setCompanyInfo(info);
      } catch (err) {
        console.error('Error fetching company info:', err);
        setError('Failed to load company information');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyInfo();
  }, []);

  return { companyInfo, loading, error };
};

/**
 * Generate dynamic customer contact message
 */
export const useDynamicMessage = () => {
  const { companyInfo } = useCompanyInfo();

  const getCustomerContactMessage = (customerName: string) => {
    if (!companyInfo) {
      return `Hi ${customerName}, thank you for choosing us! How can we assist you today?`;
    }
    return `Hi ${customerName}, thank you for choosing ${companyInfo.name}! How can we assist you today?`;
  };

  const getOrderStatusMessage = (customerName: string, orderId: string, status: string) => {
    if (!companyInfo) {
      return `Hi ${customerName}, your order #${orderId} status has been updated to: ${status}. Thank you for choosing us!`;
    }
    return `Hi ${customerName}, your order #${orderId} status has been updated to: ${status}. Thank you for choosing ${companyInfo.name}!`;
  };

  const getAppointmentReminderMessage = (customerName: string, date: string, time: string) => {
    if (!companyInfo) {
      return `Hi ${customerName}, this is a reminder for your appointment on ${date} at ${time}. We look forward to seeing you!`;
    }
    return `Hi ${customerName}, this is a reminder for your appointment at ${companyInfo.name} on ${date} at ${time}. We look forward to seeing you!`;
  };

  const getPaymentReminderMessage = (customerName: string, amount: number, orderId: string) => {
    if (!companyInfo) {
      return `Hi ${customerName}, your order #${orderId} is ready for delivery. Pending payment: ₹${amount}. Please contact us to arrange payment and delivery.`;
    }
    return `Hi ${customerName}, your order #${orderId} is ready for delivery. Pending payment: ₹${amount}. Please contact us to arrange payment and delivery.`;
  };

  return {
    companyInfo,
    getCustomerContactMessage,
    getOrderStatusMessage,
    getAppointmentReminderMessage,
    getPaymentReminderMessage
  };
};
