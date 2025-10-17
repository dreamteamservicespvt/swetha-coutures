import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bill } from './billingUtils';

/**
 * Generate a secure random token for bill sharing
 * Uses crypto.randomUUID() for cryptographically secure random tokens
 */
export const generateSecureToken = (): string => {
  // Generate a secure random token using crypto API
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(36).padStart(2, '0')).join('').substring(0, 40);
};

/**
 * Generate or retrieve a share token for a bill
 * If bill already has a token, return it; otherwise generate new one
 */
export const getOrCreateShareToken = async (billId: string): Promise<string> => {
  try {
    // Get the bill document
    const billRef = doc(db, 'bills', billId);
    const billDoc = await getDoc(billRef);
    
    if (!billDoc.exists()) {
      throw new Error('Bill not found');
    }
    
    const billData = billDoc.data();
    
    // If bill already has a share token, return it
    if (billData.shareToken) {
      return billData.shareToken;
    }
    
    // Generate new secure token
    const token = generateSecureToken();
    
    // Save token to bill document
    await updateDoc(billRef, {
      shareToken: token,
      shareTokenCreatedAt: new Date(),
      updatedAt: new Date()
    });
    
    return token;
  } catch (error) {
    console.error('Error generating share token:', error);
    throw error;
  }
};

/**
 * Get bill by share token
 * Used by public view page to fetch bill without exposing Firestore ID
 */
export const getBillByShareToken = async (token: string): Promise<Bill | null> => {
  try {
    // Query Firestore for bill with matching shareToken
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    
    const billsRef = collection(db, 'bills');
    const q = query(billsRef, where('shareToken', '==', token));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    // Return the first matching bill (should be unique)
    const billDoc = querySnapshot.docs[0];
    return {
      id: billDoc.id,
      ...billDoc.data()
    } as Bill;
  } catch (error) {
    console.error('Error fetching bill by token:', error);
    return null;
  }
};

/**
 * Add India country code (+91) to phone number if not already present
 * @param phoneNumber - Phone number (can include special characters)
 * @returns Phone number with country code
 */
export const addCountryCode = (phoneNumber: string): string => {
  // Remove any non-digit characters from phone number
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  // If phone number is exactly 10 digits (standard Indian mobile), add country code
  if (cleanPhone.length === 10) {
    return `91${cleanPhone}`;
  }
  // If phone starts with 91 and is 12 digits, it already has country code
  else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    return cleanPhone;
  }
  // If phone doesn't start with 91, prepend it
  else if (!cleanPhone.startsWith('91')) {
    return `91${cleanPhone}`;
  }
  
  return cleanPhone;
};

/**
 * Generate WhatsApp share URL with pre-filled message
 * Automatically adds India country code (+91) if not present
 */
export const generateWhatsAppShareUrl = (phoneNumber: string, shareUrl: string): string => {
  // Add country code to phone number
  const phoneWithCountryCode = addCountryCode(phoneNumber);
  
  // Create the message
  const message = `Here is your bill: ${shareUrl}

For your order, please review it and Kindly make the payment at your earliest convenience. Thank you for your support!.

Thank you for choosing Swetha Couture's 💖`;
  
  // Encode the message for URL
  const encodedMessage = encodeURIComponent(message);
  
  // Return WhatsApp URL
  // Use wa.me for universal compatibility (works on mobile and desktop)
  return `https://wa.me/${phoneWithCountryCode}?text=${encodedMessage}`;
};

/**
 * Generate the full public share URL for a bill
 */
export const generatePublicBillUrl = (token: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/view-bill/${token}`;
};

/**
 * Validate share token format
 */
export const isValidShareToken = (token: string): boolean => {
  // Token should be alphanumeric and 40 characters
  return /^[a-z0-9]{40}$/.test(token);
};
