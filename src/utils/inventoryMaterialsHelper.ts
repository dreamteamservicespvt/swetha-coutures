import { collection, getDocs, getDoc, doc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Check if an inventory item exists and has enough stock
 */
export const checkInventoryAvailability = async (inventoryId: string, requiredQuantity: number): Promise<{
  available: boolean;
  availableQuantity: number;
  message: string;
}> => {
  try {
    const inventoryDoc = await getDoc(doc(db, 'inventory', inventoryId));
    
    if (!inventoryDoc.exists()) {
      return {
        available: false,
        availableQuantity: 0,
        message: 'Item not found in inventory'
      };
    }
    
    const inventoryData = inventoryDoc.data();
    const availableQuantity = inventoryData.quantity || 0;
    
    if (availableQuantity < requiredQuantity) {
      return {
        available: false,
        availableQuantity,
        message: `Only ${availableQuantity} units available (${requiredQuantity - availableQuantity} units short)`
      };
    }
    
    return {
      available: true,
      availableQuantity,
      message: `${availableQuantity} units available`
    };
  } catch (error) {
    console.error('Error checking inventory availability:', error);
    return {
      available: false,
      availableQuantity: 0,
      message: 'Error checking inventory'
    };
  }
};

/**
 * Deduct inventory when a bill is created/updated with inventory materials
 */
export const deductInventoryForBillItems = async (billItems: any[]): Promise<{
  success: boolean;
  messages: string[];
}> => {
  const messages: string[] = [];
  let success = true;
  
  try {
    // Process each bill item with inventory reference
    for (const item of billItems) {
      if (item.inventoryId && item.quantity > 0) {
        const inventoryDoc = await getDoc(doc(db, 'inventory', item.inventoryId));
        
        if (!inventoryDoc.exists()) {
          messages.push(`Inventory item not found: ${item.materialName}`);
          success = false;
          continue;
        }
        
        const inventoryData = inventoryDoc.data();
        const currentQuantity = inventoryData.quantity || 0;
        
        if (currentQuantity < item.quantity) {
          messages.push(`Insufficient stock for ${item.materialName}: have ${currentQuantity}, need ${item.quantity}`);
          success = false;
          continue;
        }
        
        // Update inventory quantity
        await updateDoc(doc(db, 'inventory', item.inventoryId), {
          quantity: currentQuantity - item.quantity,
          updatedAt: new Date()
        });
        
        messages.push(`Deducted ${item.quantity} units of ${item.materialName}`);
      }
    }
    
    return { success, messages };
  } catch (error) {
    console.error('Error processing inventory deduction:', error);
    return { 
      success: false,
      messages: ['Error processing inventory deduction']
    };
  }
};

/**
 * Restore inventory when a bill is deleted or quantities are reduced
 */
export const restoreInventoryForBillItems = async (billItems: any[]): Promise<{
  success: boolean;
  messages: string[];
}> => {
  const messages: string[] = [];
  let success = true;
  
  try {
    // Process each bill item with inventory reference
    for (const item of billItems) {
      if (item.inventoryId && item.quantity > 0) {
        const inventoryDoc = await getDoc(doc(db, 'inventory', item.inventoryId));
        
        if (!inventoryDoc.exists()) {
          messages.push(`Inventory item not found: ${item.materialName}`);
          success = false;
          continue;
        }
        
        const inventoryData = inventoryDoc.data();
        const currentQuantity = inventoryData.quantity || 0;
        
        // Update inventory quantity
        await updateDoc(doc(db, 'inventory', item.inventoryId), {
          quantity: currentQuantity + item.quantity,
          updatedAt: new Date()
        });
        
        messages.push(`Restored ${item.quantity} units of ${item.materialName}`);
      }
    }
    
    return { success, messages };
  } catch (error) {
    console.error('Error processing inventory restoration:', error);
    return { 
      success: false,
      messages: ['Error processing inventory restoration']
    };
  }
};

/**
 * Handle inventory updates when a bill is edited
 * This function calculates the difference between old and new quantities
 */
export const updateInventoryForBillEdit = async (
  oldBillItems: any[],
  newBillItems: any[]
): Promise<{
  success: boolean;
  messages: string[];
}> => {
  const messages: string[] = [];
  let success = true;
  
  try {
    // Create maps for easier comparison
    const oldItemsMap = new Map();
    const newItemsMap = new Map();
    
    // Map old items by inventory ID
    oldBillItems.forEach(item => {
      if (item.inventoryId) {
        oldItemsMap.set(item.inventoryId, item.quantity);
      }
    });
    
    // Map new items by inventory ID
    newBillItems.forEach(item => {
      if (item.inventoryId || (item.type === 'inventory' && item.sourceId)) {
        const inventoryId = item.inventoryId || item.sourceId;
        newItemsMap.set(inventoryId, item.quantity);
      }
    });
    
    // Calculate differences and update inventory
    const allInventoryIds = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);
    
    for (const inventoryId of allInventoryIds) {
      const oldQuantity = oldItemsMap.get(inventoryId) || 0;
      const newQuantity = newItemsMap.get(inventoryId) || 0;
      const difference = newQuantity - oldQuantity;
      
      if (difference !== 0) {
        const inventoryDoc = await getDoc(doc(db, 'inventory', inventoryId));
        
        if (!inventoryDoc.exists()) {
          messages.push(`Inventory item not found: ${inventoryId}`);
          success = false;
          continue;
        }
        
        const inventoryData = inventoryDoc.data();
        const currentQuantity = inventoryData.quantity || 0;
        const newInventoryQuantity = currentQuantity - difference; // Subtract because we're deducting from inventory
        
        if (newInventoryQuantity < 0) {
          messages.push(`Insufficient stock for ${inventoryData.name}: need ${difference} more, have ${currentQuantity}`);
          success = false;
          continue;
        }
        
        await updateDoc(doc(db, 'inventory', inventoryId), {
          quantity: newInventoryQuantity,
          updatedAt: new Date()
        });
        
        if (difference > 0) {
          messages.push(`Deducted additional ${difference} units of ${inventoryData.name}`);
        } else {
          messages.push(`Restored ${Math.abs(difference)} units of ${inventoryData.name}`);
        }
      }
    }
    
    return { success, messages };
  } catch (error) {
    console.error('Error updating inventory for bill edit:', error);
    return { 
      success: false,
      messages: ['Error updating inventory for bill edit']
    };
  }
};
