import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface WorkDescription {
  id: string;
  description: string;
  category: string;
  defaultRate?: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Default work descriptions
const defaultWorkDescriptions: Omit<WorkDescription, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { description: 'Stitching - Simple Blouse', category: 'Stitching', defaultRate: 500, usageCount: 0 },
  { description: 'Stitching - Saree Blouse', category: 'Stitching', defaultRate: 600, usageCount: 0 },
  { description: 'Stitching - Churidar', category: 'Stitching', defaultRate: 800, usageCount: 0 },
  { description: 'Stitching - Lehenga', category: 'Stitching', defaultRate: 2000, usageCount: 0 },
  { description: 'Alterations - Fitting', category: 'Alterations', defaultRate: 200, usageCount: 0 },
  { description: 'Alterations - Length Adjustment', category: 'Alterations', defaultRate: 150, usageCount: 0 },
  { description: 'Alterations - Size Adjustment', category: 'Alterations', defaultRate: 300, usageCount: 0 },
  { description: 'Tailoring - Shirt', category: 'Tailoring', defaultRate: 400, usageCount: 0 },
  { description: 'Tailoring - Pant', category: 'Tailoring', defaultRate: 350, usageCount: 0 },
  { description: 'Tailoring - Suit', category: 'Tailoring', defaultRate: 1200, usageCount: 0 },
  { description: 'Designing - Custom Pattern', category: 'Designing', defaultRate: 1000, usageCount: 0 },
  { description: 'Embroidery Work', category: 'Embroidery', defaultRate: 800, usageCount: 0 },
  { description: 'Fabric Cost', category: 'Materials', defaultRate: 0, usageCount: 0 },
  { description: 'Accessories Cost', category: 'Materials', defaultRate: 0, usageCount: 0 },
  { description: 'Delivery Charges', category: 'Services', defaultRate: 50, usageCount: 0 }
];

/**
 * Get all work descriptions from Firestore with fallback to defaults
 */
export const getWorkDescriptions = async (): Promise<WorkDescription[]> => {
  try {
    const workDescDoc = await getDoc(doc(db, 'settings', 'workDescriptions'));
    if (workDescDoc.exists()) {
      const data = workDescDoc.data();
      return data.descriptions || [];
    } else {
      // Initialize with default descriptions
      await initializeWorkDescriptions();
      return getWorkDescriptions();
    }
  } catch (error) {
    console.error('Error fetching work descriptions:', error);
    // Return defaults with IDs for fallback
    return defaultWorkDescriptions.map((desc, index) => ({
      ...desc,
      id: `default-${index}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }
};

/**
 * Initialize work descriptions collection with defaults
 */
const initializeWorkDescriptions = async () => {
  try {
    const descriptionsWithIds = defaultWorkDescriptions.map((desc, index) => ({
      ...desc,
      id: `desc-${Date.now()}-${index}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await setDoc(doc(db, 'settings', 'workDescriptions'), {
      descriptions: descriptionsWithIds,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error initializing work descriptions:', error);
  }
};

/**
 * Add a new work description
 */
export const addWorkDescription = async (description: string, category: string, defaultRate?: number): Promise<void> => {
  try {
    const workDescDoc = await getDoc(doc(db, 'settings', 'workDescriptions'));
    
    const newDescription: WorkDescription = {
      id: `desc-${Date.now()}`,
      description,
      category,
      defaultRate: defaultRate || 0,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (workDescDoc.exists()) {
      const data = workDescDoc.data();
      const descriptions = data.descriptions || [];
      
      // Check if description already exists
      const exists = descriptions.some((desc: WorkDescription) => 
        desc.description.toLowerCase() === description.toLowerCase()
      );
      
      if (!exists) {
        descriptions.push(newDescription);
        await updateDoc(doc(db, 'settings', 'workDescriptions'), {
          descriptions,
          updatedAt: new Date()
        });
      }
    } else {
      await setDoc(doc(db, 'settings', 'workDescriptions'), {
        descriptions: [newDescription],
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error adding work description:', error);
    throw error;
  }
};

/**
 * Update usage count for a work description
 */
export const updateWorkDescriptionUsage = async (descriptionId: string): Promise<void> => {
  try {
    const workDescDoc = await getDoc(doc(db, 'settings', 'workDescriptions'));
    if (workDescDoc.exists()) {
      const data = workDescDoc.data();
      const descriptions = data.descriptions || [];
      
      const updatedDescriptions = descriptions.map((desc: WorkDescription) => {
        if (desc.id === descriptionId) {
          return {
            ...desc,
            usageCount: (desc.usageCount || 0) + 1,
            updatedAt: new Date()
          };
        }
        return desc;
      });
      
      await updateDoc(doc(db, 'settings', 'workDescriptions'), {
        descriptions: updatedDescriptions,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating work description usage:', error);
  }
};

/**
 * Get work descriptions grouped by category
 */
export const getWorkDescriptionsByCategory = async (): Promise<Record<string, WorkDescription[]>> => {
  const descriptions = await getWorkDescriptions();
  
  return descriptions.reduce((acc, desc) => {
    if (!acc[desc.category]) {
      acc[desc.category] = [];
    }
    acc[desc.category].push(desc);
    return acc;
  }, {} as Record<string, WorkDescription[]>);
};

/**
 * Get most used work descriptions (top 10)
 */
export const getMostUsedWorkDescriptions = async (): Promise<WorkDescription[]> => {
  const descriptions = await getWorkDescriptions();
  return descriptions
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    .slice(0, 10);
};
