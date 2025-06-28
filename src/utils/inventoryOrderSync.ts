
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface OrderItem {
  type: string;
  quantity: number;
}

interface RequiredMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  quantity: number;
  unit: string;
  minStock?: number;
  createdAt?: any;
  updatedAt?: any;
}

export const updateInventoryStock = async (orderItems: OrderItem[]): Promise<{ success: boolean; missingItems: string[] }> => {
  const missingItems: string[] = [];
  
  try {
    for (const orderItem of orderItems) {
      // Find matching inventory items by type
      const inventoryQuery = query(
        collection(db, 'inventory'),
        where('type', '==', orderItem.type),
        where('quantity', '>', 0)
      );
      
      const inventorySnapshot = await getDocs(inventoryQuery);
      
      if (inventorySnapshot.empty) {
        missingItems.push(orderItem.type);
        continue;
      }
      
      let remainingQuantity = orderItem.quantity;
      
      for (const inventoryDoc of inventorySnapshot.docs) {
        if (remainingQuantity <= 0) break;
        
        const inventoryData = inventoryDoc.data() as InventoryItem;
        const availableQuantity = inventoryData.quantity;
        
        const deductQuantity = Math.min(remainingQuantity, availableQuantity);
        const newQuantity = availableQuantity - deductQuantity;
        
        await updateDoc(doc(db, 'inventory', inventoryDoc.id), {
          quantity: newQuantity,
          updatedAt: serverTimestamp()
        });
        
        remainingQuantity -= deductQuantity;
        
        console.log(`Deducted ${deductQuantity} units of ${inventoryData.name}. New quantity: ${newQuantity}`);
      }
      
      if (remainingQuantity > 0) {
        missingItems.push(`${orderItem.type} (${remainingQuantity} units short)`);
      }
    }
    
    return { success: missingItems.length === 0, missingItems };
  } catch (error) {
    console.error('Error updating inventory:', error);
    return { success: false, missingItems: ['Error updating inventory'] };
  }
};

export const deductInventoryForOrder = async (orderItems: OrderItem[]): Promise<{ success: boolean; missingItems: string[] }> => {
  const missingItems: string[] = [];
  
  try {
    for (const orderItem of orderItems) {
      // Handle direct ID references (for required materials)
      if (orderItem.type.length >= 20) { // Firestore document IDs are typically 20 characters
        try {
          const inventoryDocRef = doc(db, 'inventory', orderItem.type);
          const inventoryDoc = await getDoc(inventoryDocRef);
          
          if (inventoryDoc.exists()) {
            const inventoryData = inventoryDoc.data() as InventoryItem;
            const availableQuantity = inventoryData.quantity;
            
            if (availableQuantity >= orderItem.quantity) {
              await updateDoc(inventoryDocRef, {
                quantity: availableQuantity - orderItem.quantity,
                updatedAt: serverTimestamp()
              });
              console.log(`Deducted ${orderItem.quantity} units of ${inventoryData.name}. New quantity: ${availableQuantity - orderItem.quantity}`);
            } else {
              missingItems.push(`${inventoryData.name} (${orderItem.quantity - availableQuantity} units short)`);
            }
          } else {
            missingItems.push(`Item with ID ${orderItem.type} not found`);
          }
        } catch (error) {
          console.error('Error processing inventory item by ID:', error);
          missingItems.push(`Error processing ${orderItem.type}`);
        }
        continue;
      }
      
      // Fallback to name/type search for other items
      let inventoryQuery = query(
        collection(db, 'inventory'),
        where('name', '==', orderItem.type)
      );
      
      let inventorySnapshot = await getDocs(inventoryQuery);
      
      // If not found by name, try by type
      if (inventorySnapshot.empty) {
        inventoryQuery = query(
          collection(db, 'inventory'),
          where('type', '==', orderItem.type)
        );
        inventorySnapshot = await getDocs(inventoryQuery);
      }
      
      if (inventorySnapshot.empty) {
        missingItems.push(`${orderItem.type} - not found in inventory`);
        continue;
      }
      
      let remainingQuantity = orderItem.quantity;
      
      for (const inventoryDoc of inventorySnapshot.docs) {
        if (remainingQuantity <= 0) break;
        
        const inventoryData = inventoryDoc.data() as InventoryItem;
        const availableQuantity = inventoryData.quantity;
        
        const deductQuantity = Math.min(remainingQuantity, availableQuantity);
        const newQuantity = availableQuantity - deductQuantity;
        
        await updateDoc(doc(db, 'inventory', inventoryDoc.id), {
          quantity: newQuantity,
          updatedAt: serverTimestamp()
        });
        
        remainingQuantity -= deductQuantity;
        
        console.log(`Deducted ${deductQuantity} units of ${inventoryData.name}. New quantity: ${newQuantity}`);
      }
      
      if (remainingQuantity > 0) {
        missingItems.push(`${orderItem.type} (${remainingQuantity} units short)`);
      }
    }
    
    return { success: missingItems.length === 0, missingItems };
  } catch (error) {
    console.error('Error deducting inventory:', error);
    return { success: false, missingItems: ['Error updating inventory'] };
  }
};

export const checkInventoryAvailability = async (orderItems: OrderItem[]): Promise<{ available: boolean; shortages: string[] }> => {
  const shortages: string[] = [];
  
  try {
    for (const orderItem of orderItems) {
      // Handle direct ID references
      if (orderItem.type.length >= 20) {
        try {
          const inventoryDocRef = doc(db, 'inventory', orderItem.type);
          const inventoryDoc = await getDoc(inventoryDocRef);
          
          if (inventoryDoc.exists()) {
            const inventoryData = inventoryDoc.data() as InventoryItem;
            if (inventoryData.quantity < orderItem.quantity) {
              shortages.push(`${inventoryData.name} - need ${orderItem.quantity}, have ${inventoryData.quantity}`);
            }
          } else {
            shortages.push(`Item with ID ${orderItem.type} not found`);
          }
        } catch (error) {
          console.error('Error checking inventory item by ID:', error);
          shortages.push(`Error checking ${orderItem.type}`);
        }
        continue;
      }
      
      // Search by name or type
      let inventoryQuery = query(
        collection(db, 'inventory'),
        where('name', '==', orderItem.type)
      );
      
      let inventorySnapshot = await getDocs(inventoryQuery);
      
      if (inventorySnapshot.empty) {
        inventoryQuery = query(
          collection(db, 'inventory'),
          where('type', '==', orderItem.type)
        );
        inventorySnapshot = await getDocs(inventoryQuery);
      }
      
      if (inventorySnapshot.empty) {
        shortages.push(`${orderItem.type} - not in inventory`);
        continue;
      }
      
      const totalAvailable = inventorySnapshot.docs.reduce(
        (sum, doc) => sum + (doc.data() as InventoryItem).quantity,
        0
      );
      
      if (totalAvailable < orderItem.quantity) {
        shortages.push(`${orderItem.type} - need ${orderItem.quantity}, have ${totalAvailable}`);
      }
    }
    
    return { available: shortages.length === 0, shortages };
  } catch (error) {
    console.error('Error checking inventory availability:', error);
    return { available: false, shortages: ['Error checking inventory'] };
  }
};

// Function specifically for required materials with proper ID handling
export const deductRequiredMaterials = async (materials: RequiredMaterial[]): Promise<{ success: boolean; missingItems: string[] }> => {
  const missingItems: string[] = [];
  
  try {
    for (const material of materials) {
      try {
        const inventoryDocRef = doc(db, 'inventory', material.id);
        const inventoryDoc = await getDoc(inventoryDocRef);
        
        if (inventoryDoc.exists()) {
          const inventoryData = inventoryDoc.data() as InventoryItem;
          const availableQuantity = inventoryData.quantity;
          
          if (availableQuantity >= material.quantity) {
            await updateDoc(inventoryDocRef, {
              quantity: availableQuantity - material.quantity,
              updatedAt: serverTimestamp()
            });
            console.log(`Deducted ${material.quantity} ${material.unit} of ${material.name}`);
          } else {
            missingItems.push(`${material.name} (${material.quantity - availableQuantity} ${material.unit} short)`);
          }
        } else {
          missingItems.push(`${material.name} - not found in inventory`);
        }
      } catch (error) {
        console.error(`Error processing material ${material.name}:`, error);
        missingItems.push(`Error processing ${material.name}`);
      }
    }
    
    return { success: missingItems.length === 0, missingItems };
  } catch (error) {
    console.error('Error deducting required materials:', error);
    return { success: false, missingItems: ['Error deducting materials'] };
  }
};

// Function to restore inventory when an order is cancelled
export const restoreInventoryForOrder = async (orderItems: OrderItem[]): Promise<{ success: boolean; errors: string[] }> => {
  const errors: string[] = [];
  
  try {
    for (const orderItem of orderItems) {
      // Handle direct ID references
      if (orderItem.type.length >= 20) {
        try {
          const inventoryDocRef = doc(db, 'inventory', orderItem.type);
          const inventoryDoc = await getDoc(inventoryDocRef);
          
          if (inventoryDoc.exists()) {
            const inventoryData = inventoryDoc.data() as InventoryItem;
            await updateDoc(inventoryDocRef, {
              quantity: inventoryData.quantity + orderItem.quantity,
              updatedAt: serverTimestamp()
            });
            console.log(`Restored ${orderItem.quantity} units of ${inventoryData.name}`);
          } else {
            errors.push(`Item with ID ${orderItem.type} not found for restoration`);
          }
        } catch (error) {
          console.error('Error restoring inventory item by ID:', error);
          errors.push(`Error restoring ${orderItem.type}`);
        }
        continue;
      }
      
      // Search by name or type for restoration
      let inventoryQuery = query(
        collection(db, 'inventory'),
        where('name', '==', orderItem.type)
      );
      
      let inventorySnapshot = await getDocs(inventoryQuery);
      
      if (inventorySnapshot.empty) {
        inventoryQuery = query(
          collection(db, 'inventory'),
          where('type', '==', orderItem.type)
        );
        inventorySnapshot = await getDocs(inventoryQuery);
      }
      
      if (!inventorySnapshot.empty) {
        // Restore to the first matching item
        const inventoryDoc = inventorySnapshot.docs[0];
        const inventoryData = inventoryDoc.data() as InventoryItem;
        
        await updateDoc(inventoryDoc.ref, {
          quantity: inventoryData.quantity + orderItem.quantity,
          updatedAt: serverTimestamp()
        });
        
        console.log(`Restored ${orderItem.quantity} units of ${inventoryData.name}`);
      } else {
        errors.push(`${orderItem.type} - not found for restoration`);
      }
    }
    
    return { success: errors.length === 0, errors };
  } catch (error) {
    console.error('Error restoring inventory:', error);
    return { success: false, errors: ['Error restoring inventory'] };
  }
};
