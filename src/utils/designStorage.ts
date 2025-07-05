import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface DesignData {
  id: string;
  orderId: string;
  itemIndex: number;
  canvasData: any;
  imageUrl: string;
  lastModified: Date;
  version: number;
}

// Save design data to Firebase
export const saveDesignData = async (orderId: string, itemIndex: number, canvasData: any, imageUrl: string): Promise<void> => {
  try {
    const designId = `${orderId}_item_${itemIndex}`;
    const designRef = doc(db, 'designs', designId);
    
    const designData: Omit<DesignData, 'id'> = {
      orderId,
      itemIndex,
      canvasData,
      imageUrl,
      lastModified: new Date(),
      version: 1
    };

    // Check if design exists to increment version
    const existingDoc = await getDoc(designRef);
    if (existingDoc.exists()) {
      const existingData = existingDoc.data();
      designData.version = (existingData.version || 1) + 1;
    }

    await setDoc(designRef, designData, { merge: true });
    console.log('Design saved successfully:', designId);
  } catch (error) {
    console.error('Error saving design data:', error);
    throw error;
  }
};

// Load design data from Firebase
export const loadDesignData = async (orderId: string, itemIndex: number): Promise<DesignData | null> => {
  try {
    const designId = `${orderId}_item_${itemIndex}`;
    const designRef = doc(db, 'designs', designId);
    const designDoc = await getDoc(designRef);
    
    if (designDoc.exists()) {
      const data = designDoc.data();
      return {
        id: designId,
        ...data
      } as DesignData;
    }
    
    return null;
  } catch (error) {
    console.error('Error loading design data:', error);
    return null;
  }
};

// List all designs for an order
export const getOrderDesigns = async (orderId: string): Promise<DesignData[]> => {
  try {
    // This would require a compound query in a real implementation
    // For now, we'll return empty array and handle per-item basis
    return [];
  } catch (error) {
    console.error('Error loading order designs:', error);
    return [];
  }
};

// Delete design data
export const deleteDesignData = async (orderId: string, itemIndex: number): Promise<void> => {
  try {
    const designId = `${orderId}_item_${itemIndex}`;
    const designRef = doc(db, 'designs', designId);
    
    // Instead of deleting, we'll mark as deleted to preserve history
    await updateDoc(designRef, {
      deleted: true,
      deletedAt: new Date()
    });
    
    console.log('Design marked as deleted:', designId);
  } catch (error) {
    console.error('Error deleting design data:', error);
    throw error;
  }
};

// Export design as different formats
export const exportDesignData = (canvasData: any, format: 'json' | 'pdf' | 'png'): string => {
  switch (format) {
    case 'json':
      return JSON.stringify(canvasData, null, 2);
    case 'pdf':
    case 'png':
      // These would be handled by the canvas component itself
      return '';
    default:
      return JSON.stringify(canvasData);
  }
};
