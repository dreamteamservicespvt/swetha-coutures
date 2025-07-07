import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface CustomerSizeHistory {
  itemType: string;
  madeFor: string;
  sizes: Record<string, string>;
  orderId: string;
  orderDate: any;
}

export interface MadeForSuggestion {
  name: string;
  frequency: number;
  lastUsed: any;
}

/**
 * Fetches size history for a specific customer and item type combination
 */
export const getCustomerSizeHistory = async (
  customerName: string,
  itemType?: string
): Promise<CustomerSizeHistory[]> => {
  if (!customerName.trim()) return [];

  try {
    // Query orders for this customer
    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerName', '==', customerName)
    );
    
    const ordersSnapshot = await getDocs(ordersQuery);
    const sizeHistory: CustomerSizeHistory[] = [];

    ordersSnapshot.docs.forEach(doc => {
      const orderData = doc.data();
      const orderId = orderData.orderId || doc.id;
      const orderDate = orderData.createdAt || orderData.orderDate;

      // Process items in the order
      if (orderData.items && Array.isArray(orderData.items)) {
        orderData.items.forEach((item: any) => {
          // Filter by item type if specified
          if (itemType && (item.category || item.itemType)?.toLowerCase() !== itemType.toLowerCase()) {
            return;
          }

          // Only include items with size data
          if (item.sizes && Object.keys(item.sizes).length > 0) {
            sizeHistory.push({
              itemType: item.category || item.itemType || 'Unknown',
              madeFor: item.madeFor || orderData.customerName || customerName,
              sizes: item.sizes,
              orderId,
              orderDate
            });
          }
        });
      }
    });

    // Sort by most recent first
    return sizeHistory.sort((a, b) => {
      const dateA = a.orderDate?.toDate ? a.orderDate.toDate() : new Date(a.orderDate || 0);
      const dateB = b.orderDate?.toDate ? b.orderDate.toDate() : new Date(b.orderDate || 0);
      return dateB.getTime() - dateA.getTime();
    });

  } catch (error) {
    console.error('Error fetching customer size history:', error);
    return [];
  }
};

/**
 * Suggests sizes for a specific customer, item type, and "made for" combination
 */
export const getSizeSuggestions = async (
  customerName: string,
  itemType: string,
  madeFor: string
): Promise<Record<string, string> | null> => {
  if (!customerName.trim() || !itemType.trim() || !madeFor.trim()) return null;

  try {
    const sizeHistory = await getCustomerSizeHistory(customerName, itemType);
    
    // Look for exact match first (same itemType and madeFor)
    const exactMatch = sizeHistory.find(
      history => 
        history.itemType.toLowerCase() === itemType.toLowerCase() &&
        history.madeFor.toLowerCase() === madeFor.toLowerCase()
    );

    if (exactMatch) {
      return exactMatch.sizes;
    }

    // If no exact match, look for same itemType but different madeFor
    const itemTypeMatch = sizeHistory.find(
      history => history.itemType.toLowerCase() === itemType.toLowerCase()
    );

    if (itemTypeMatch) {
      return itemTypeMatch.sizes;
    }

    return null;
  } catch (error) {
    console.error('Error getting size suggestions:', error);
    return null;
  }
};

/**
 * Gets "made for" suggestions based on customer's order history
 */
export const getMadeForSuggestions = async (customerName: string): Promise<MadeForSuggestion[]> => {
  if (!customerName.trim()) return [];

  try {
    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerName', '==', customerName)
    );
    
    const ordersSnapshot = await getDocs(ordersQuery);
    const madeForMap = new Map<string, { frequency: number; lastUsed: any }>();

    // Always include the customer's name in the suggestions
    madeForMap.set(customerName, { frequency: 1, lastUsed: new Date() });
    
    ordersSnapshot.docs.forEach(doc => {
      const orderData = doc.data();
      const orderDate = orderData.createdAt || orderData.orderDate;

      // Process items in the order
      if (orderData.items && Array.isArray(orderData.items)) {
        orderData.items.forEach((item: any) => {
          const madeFor = item.madeFor;
          
          // Include ALL madeFor entries, even if they match the customer name
          // This ensures we track frequency correctly
          if (madeFor && madeFor.trim()) {
            const existing = madeForMap.get(madeFor) || { frequency: 0, lastUsed: null };
            madeForMap.set(madeFor, {
              frequency: existing.frequency + 1,
              lastUsed: !existing.lastUsed || (orderDate && orderDate > existing.lastUsed) 
                ? orderDate 
                : existing.lastUsed
            });
          }
        });
      }
    });

    // Convert to array and sort by frequency, then by recency
    const suggestions: MadeForSuggestion[] = Array.from(madeForMap.entries()).map(([name, data]) => ({
      name,
      frequency: data.frequency,
      lastUsed: data.lastUsed
    }));

    return suggestions.sort((a, b) => {
      // First sort by frequency (higher is better)
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      
      // Then by recency (more recent is better)
      const dateA = a.lastUsed?.toDate ? a.lastUsed.toDate() : new Date(a.lastUsed || 0);
      const dateB = b.lastUsed?.toDate ? b.lastUsed.toDate() : new Date(b.lastUsed || 0);
      return dateB.getTime() - dateA.getTime();
    });

  } catch (error) {
    console.error('Error getting made for suggestions:', error);
    return [];
  }
};

/**
 * Gets the most recent sizes for a customer across all item types
 */
export const getCustomerRecentSizes = async (customerName: string): Promise<Record<string, string>> => {
  if (!customerName.trim()) return {};

  try {
    const sizeHistory = await getCustomerSizeHistory(customerName);
    
    // Aggregate all sizes from recent orders, with more recent taking precedence
    const aggregatedSizes: Record<string, string> = {};
    
    // Reverse the array so we process older orders first, then newer ones override
    sizeHistory.reverse().forEach(history => {
      Object.entries(history.sizes).forEach(([key, value]) => {
        if (value && value.trim()) {
          aggregatedSizes[key] = value;
        }
      });
    });

    return aggregatedSizes;
  } catch (error) {
    console.error('Error getting customer recent sizes:', error);
    return {};
  }
};
