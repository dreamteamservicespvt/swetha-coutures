import { collection, query, orderBy, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Utility to diagnose and fix duplicate Bill096 issues
 * This will:
 * 1. Find all bills with billId "Bill096"
 * 2. Re-assign them sequential bill numbers based on their creation date
 * 3. Update both billId and billNumber fields
 */

export interface DuplicateBillInfo {
  id: string;
  billId: string;
  billNumber?: number;
  customerName: string;
  date: any;
  createdAt: any;
  totalAmount: number;
}

export interface FixResult {
  oldBillId: string;
  newBillId: string;
  oldBillNumber?: number;
  newBillNumber: number;
  docId: string;
  customerName: string;
}

/**
 * Diagnose duplicate Bill096 issues
 * Returns array of bills with Bill096 ID sorted by date
 */
export const diagnoseDuplicateBills = async (): Promise<DuplicateBillInfo[]> => {
  try {
    const billsRef = collection(db, 'bills');
    const billsQuery = query(billsRef, orderBy('date', 'asc'));
    const snapshot = await getDocs(billsQuery);
    
    const allBills: DuplicateBillInfo[] = [];
    const bill096Duplicates: DuplicateBillInfo[] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const billInfo: DuplicateBillInfo = {
        id: doc.id,
        billId: data.billId || 'N/A',
        billNumber: data.billNumber,
        customerName: data.customerName || 'N/A',
        date: data.date,
        createdAt: data.createdAt,
        totalAmount: data.totalAmount || 0
      };
      
      allBills.push(billInfo);
      
      if (data.billId === 'Bill096') {
        bill096Duplicates.push(billInfo);
      }
    });
    
    console.log('Total bills:', allBills.length);
    console.log('Bill096 duplicates found:', bill096Duplicates.length);
    
    return bill096Duplicates;
  } catch (error) {
    console.error('Error diagnosing duplicate bills:', error);
    throw error;
  }
};

/**
 * Fix duplicate Bill096 entries by reassigning sequential numbers
 * This will find the highest existing bill number and continue from there
 */
export const fixDuplicateBills = async (): Promise<FixResult[]> => {
  try {
    // Get all bills ordered by date
    const billsRef = collection(db, 'bills');
    const billsQuery = query(billsRef, orderBy('date', 'asc'));
    const snapshot = await getDocs(billsQuery);
    
    // Collect all bills and find the highest bill number
    const allBills: Array<{
      id: string;
      billId: string;
      billNumber?: number;
      customerName: string;
      date: any;
    }> = [];
    
    let highestBillNumber = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const billInfo = {
        id: doc.id,
        billId: data.billId || 'N/A',
        billNumber: data.billNumber,
        customerName: data.customerName || 'N/A',
        date: data.date
      };
      
      allBills.push(billInfo);
      
      // Track highest bill number (excluding Bill096 duplicates)
      if (data.billId !== 'Bill096' && typeof data.billNumber === 'number' && data.billNumber > highestBillNumber) {
        highestBillNumber = data.billNumber;
      }
    });
    
    console.log('Highest existing bill number:', highestBillNumber);
    
    // Find all Bill096 duplicates
    const bill096Duplicates = allBills.filter(bill => bill.billId === 'Bill096');
    
    if (bill096Duplicates.length === 0) {
      console.log('No Bill096 duplicates found');
      return [];
    }
    
    console.log(`Found ${bill096Duplicates.length} Bill096 duplicate(s)`);
    
    // Sort duplicates by date
    bill096Duplicates.sort((a, b) => {
      const dateA = a.date?.seconds ? new Date(a.date.seconds * 1000) : new Date(0);
      const dateB = b.date?.seconds ? new Date(b.date.seconds * 1000) : new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Assign new sequential bill numbers starting from highestBillNumber + 1
    const fixResults: FixResult[] = [];
    let nextBillNumber = highestBillNumber + 1;
    
    for (const duplicate of bill096Duplicates) {
      const newBillId = `Bill${nextBillNumber.toString().padStart(3, '0')}`;
      
      // Update the bill in Firestore
      const billRef = doc(db, 'bills', duplicate.id);
      await updateDoc(billRef, {
        billId: newBillId,
        billNumber: nextBillNumber,
        updatedAt: new Date()
      });
      
      fixResults.push({
        oldBillId: duplicate.billId,
        newBillId: newBillId,
        oldBillNumber: duplicate.billNumber,
        newBillNumber: nextBillNumber,
        docId: duplicate.id,
        customerName: duplicate.customerName
      });
      
      console.log(`Fixed: ${duplicate.billId} (${duplicate.customerName}) → ${newBillId}`);
      
      nextBillNumber++;
    }
    
    return fixResults;
  } catch (error) {
    console.error('Error fixing duplicate bills:', error);
    throw error;
  }
};

/**
 * Get all bill IDs and numbers for verification
 */
export const getAllBillsInfo = async (): Promise<Array<{
  id: string;
  billId: string;
  billNumber?: number;
  customerName: string;
  date: any;
}>> => {
  try {
    const billsRef = collection(db, 'bills');
    const billsQuery = query(billsRef, orderBy('billNumber', 'desc'));
    const snapshot = await getDocs(billsQuery);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        billId: data.billId || 'N/A',
        billNumber: data.billNumber,
        customerName: data.customerName || 'N/A',
        date: data.date
      };
    });
  } catch (error) {
    console.error('Error getting all bills info:', error);
    throw error;
  }
};
