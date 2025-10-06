// Bill Migration Utilities
// Use these functions in your admin dashboard

import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Diagnose existing bills in the database
 * Shows what bill IDs currently exist and identifies issues
 */
export async function diagnoseBills(): Promise<{
  total: number;
  bills: Array<{ id: string; billId: string; billNumber: number | null; customer: string; date: any }>;
  duplicates: string[];
  formats: {
    correct: number;
    hash: number;
    timestamp: number;
    missing: number;
  };
}> {
  try {
    const billsRef = collection(db, 'bills');
    // Order by date (bill date) first, then by createdAt as fallback
    const q = query(billsRef, orderBy('date', 'asc'));
    const snapshot = await getDocs(q);
    
    const bills: Array<{ id: string; billId: string; billNumber: number | null; customer: string; date: any }> = [];
    const billIdCounts = new Map<string, number>();
    const formats = {
      correct: 0,  // Bill001 format
      hash: 0,     // #101 format
      timestamp: 0, // BILL215896 format
      missing: 0   // Missing or invalid
    };
    
    snapshot.docs.forEach(document => {
      const data = document.data();
      const billId = data.billId || 'MISSING';
      const billNumber = typeof data.billNumber === 'number' ? data.billNumber : null;
      const customer = data.customer?.name || data.customerName || 'Unknown';
      const date = data.date;
      
      bills.push({
        id: document.id,
        billId,
        billNumber,
        customer,
        date
      });
      
      // Count occurrences
      billIdCounts.set(billId, (billIdCounts.get(billId) || 0) + 1);
      
      // Categorize format
      if (billId === 'MISSING' || !billId) {
        formats.missing++;
      } else if (/^Bill\d{3,}$/.test(billId)) {
        formats.correct++;
      } else if (billId.startsWith('#')) {
        formats.hash++;
      } else if (/^BILL\d{6}$/.test(billId)) {
        formats.timestamp++;
      } else {
        formats.missing++;
      }
    });
    
    // Find duplicates
    const duplicates = Array.from(billIdCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([billId]) => billId);
    
    return {
      total: snapshot.size,
      bills,
      duplicates,
      formats
    };
  } catch (error) {
    console.error('Error diagnosing bills:', error);
    throw error;
  }
}

/**
 * Migrate all bills to new Bill001 format
 * Reassigns sequential IDs starting from Bill001
 * 
 * @param dryRun - If true, returns what would be changed without actually changing anything
 */
export async function migrateBills(dryRun: boolean = false): Promise<{
  success: number;
  failed: number;
  changes: Array<{ id: string; oldBillId: string; newBillId: string; billNumber: number; date: any }>;
}> {
  try {
    const billsRef = collection(db, 'bills');
    // Order by date (bill date) ascending - oldest bills get lowest numbers
    const q = query(billsRef, orderBy('date', 'asc'));
    const snapshot = await getDocs(q);
    
    const changes: Array<{ id: string; oldBillId: string; newBillId: string; billNumber: number; date: any }> = [];
    
    // Plan the migration
    snapshot.docs.forEach((document, index) => {
      const billNumber = index + 1;
      const newBillId = `Bill${billNumber.toString().padStart(3, '0')}`;
      const oldBillId = document.data().billId || 'MISSING';
      const date = document.data().date;
      
      changes.push({
        id: document.id,
        oldBillId,
        newBillId,
        billNumber,
        date
      });
    });
    
    // If dry run, just return the plan
    if (dryRun) {
      return {
        success: 0,
        failed: 0,
        changes
      };
    }
    
    // Execute the migration
    let success = 0;
    let failed = 0;
    
    for (const change of changes) {
      try {
        const billRef = doc(db, 'bills', change.id);
        await updateDoc(billRef, {
          billId: change.newBillId,
          billNumber: change.billNumber
        });
        success++;
      } catch (error) {
        console.error(`Failed to update bill ${change.id}:`, error);
        failed++;
      }
    }
    
    return {
      success,
      failed,
      changes
    };
  } catch (error) {
    console.error('Error migrating bills:', error);
    throw error;
  }
}

/**
 * Get a preview of what the migration will do
 */
export async function getMigrationPreview() {
  return await migrateBills(true);
}

/**
 * Execute the migration (actually update the database)
 */
export async function executeMigration() {
  return await migrateBills(false);
}
