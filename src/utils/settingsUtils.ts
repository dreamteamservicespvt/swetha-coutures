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
 * Get dynamic company information from business settings
 */
export const getCompanyInfo = async () => {
  try {
    const settings = await getBusinessSettings();
    
    // Parse address into components
    const addressParts = settings.businessAddress ? settings.businessAddress.split('\n') : [];
    const streetAddress = addressParts[0] || 'Premium Tailoring & Fashion Excellence';
    const cityAddress = addressParts.slice(1).join(', ') || 'Bangalore, Karnataka';
    
    return {
      name: settings.businessName || 'Swetha\'s Couture',
      address: streetAddress,
      city: cityAddress,
      phone: settings.businessPhone || '+91 98765 43210',
      email: settings.businessEmail || 'contact@swethascouture.com',
      taxNumber: settings.taxNumber || '',
      fullAddress: settings.businessAddress || 'Premium Tailoring & Fashion Excellence\nBangalore, Karnataka'
    };
  } catch (error) {
    console.warn('Could not load company info, using defaults:', error);
    return {
      name: 'Swetha\'s Couture',
      address: 'Premium Tailoring & Fashion Excellence',
      city: 'Bangalore, Karnataka',
      phone: '+91 98765 43210',
      email: 'contact@swethascouture.com',
      taxNumber: '',
      fullAddress: 'Premium Tailoring & Fashion Excellence\nBangalore, Karnataka'
    };
  }
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
