import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface BusinessSettings {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  businessLogo?: string;
  taxNumber?: string;
  bankDetails: {
    accountName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
  };
  upiId: string;
  businessHours?: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
}

// Default business settings fallback
const defaultBusinessSettings: BusinessSettings = {
  businessName: 'Swetha\'s Couture',
  businessAddress: '',
  businessPhone: '',
  businessEmail: '',
  bankDetails: {
    accountName: 'Swetha\'s Couture',
    accountNumber: '1234567890',
    ifsc: 'HDFC0001234',
    bankName: 'HDFC Bank'
  },
  upiId: 'swethascouture@paytm'
};

/**
 * Get business settings from Firestore with fallback to defaults
 */
export const getBusinessSettings = async (): Promise<BusinessSettings> => {
  try {
    const businessDoc = await getDoc(doc(db, 'settings', 'business'));
    if (businessDoc.exists()) {
      const data = businessDoc.data() as Partial<BusinessSettings>;
      
      // Merge with defaults to ensure all required fields exist
      return {
        ...defaultBusinessSettings,
        ...data,
        bankDetails: {
          ...defaultBusinessSettings.bankDetails,
          ...(data.bankDetails || {})
        }
      };
    }
  } catch (error) {
    console.error('Error fetching business settings:', error);
  }
  
  // Return defaults if unable to fetch or no document exists
  return defaultBusinessSettings;
};

/**
 * Get payment settings specifically (UPI ID and Bank Details)
 */
export const getPaymentSettings = async () => {
  const settings = await getBusinessSettings();
  return {
    upiId: settings.upiId,
    bankDetails: settings.bankDetails
  };
};
