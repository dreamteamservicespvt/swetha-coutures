import React, { createContext, useState, useEffect, useContext } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BusinessSettings } from '@/utils/billingUtils';

interface BusinessSettingsContextType {
  settings: BusinessSettings | null;
  loading: boolean;
  error: Error | null;
  refreshSettings: () => Promise<void>;
}

const BusinessSettingsContext = createContext<BusinessSettingsContextType>({
  settings: null,
  loading: true,
  error: null,
  refreshSettings: async () => {}
});

export const useBusinessSettings = () => useContext(BusinessSettingsContext);

export const BusinessSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const settingsDoc = await getDoc(doc(db, 'settings', 'business'));
      
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as BusinessSettings);
      } else {
        // Use default values if settings don't exist
        setSettings({
          businessName: "Swetha's Couture",
          businessPhone: "+91 98765 43210",
          businessEmail: "info@swethascouture.com",
          businessAddress: "123 Fashion Street, Chennai, Tamil Nadu, India",
          taxNumber: "GST: 33AABCS1234Z1ZX",
          logo: "https://via.placeholder.com/150x80?text=Couture+Logo"
        });
      }
    } catch (err) {
      console.error("Failed to fetch business settings:", err);
      setError(err instanceof Error ? err : new Error('Unknown error fetching settings'));
      
      // Set default values on error
      setSettings({
        businessName: "Swetha's Couture",
        businessPhone: "+91 98765 43210",
        businessEmail: "info@swethascouture.com",
        businessAddress: "123 Fashion Street, Chennai, Tamil Nadu, India",
        taxNumber: "GST: 33AABCS1234Z1ZX",
        logo: "https://via.placeholder.com/150x80?text=Couture+Logo"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <BusinessSettingsContext.Provider 
      value={{ 
        settings, 
        loading, 
        error, 
        refreshSettings: fetchSettings 
      }}
    >
      {children}
    </BusinessSettingsContext.Provider>
  );
};

