// Fix Date Format Script
// Converts plain date objects to Firebase Timestamps for bills 75-95

import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface DateMap {
  seconds: number;
  nanoseconds: number;
}

function isDateMap(value: any): value is DateMap {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.seconds === 'number' &&
    typeof value.nanoseconds === 'number' &&
    !value.toDate // Not already a Timestamp
  );
}

function convertToTimestamp(dateValue: any): Timestamp | null {
  // Already a Timestamp
  if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
    return dateValue;
  }
  
  // Plain object with seconds/nanoseconds
  if (isDateMap(dateValue)) {
    return new Timestamp(dateValue.seconds, dateValue.nanoseconds);
  }
  
  // String date
  if (typeof dateValue === 'string') {
    try {
      return Timestamp.fromDate(new Date(dateValue));
    } catch (error) {
      console.error('Failed to convert string date:', dateValue);
      return null;
    }
  }
  
  // Date object
  if (dateValue instanceof Date) {
    return Timestamp.fromDate(dateValue);
  }
  
  return null;
}

export async function fixDateFormats(): Promise<{
  success: number;
  failed: number;
  skipped: number;
  details: Array<{
    id: string;
    billId: string;
    action: 'fixed' | 'skipped' | 'failed';
    reason?: string;
  }>;
}> {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    details: [] as Array<{
      id: string;
      billId: string;
      action: 'fixed' | 'skipped' | 'failed';
      reason?: string;
    }>
  };

  try {
    console.log('🔍 Fetching all bills...');
    const billsRef = collection(db, 'bills');
    const snapshot = await getDocs(billsRef);

    console.log(`📊 Found ${snapshot.size} bills to check\n`);

    for (const document of snapshot.docs) {
      const data = document.data();
      const billId = data.billId || document.id;
      
      let needsUpdate = false;
      const updates: any = {};

      // Check createdAt
      if (isDateMap(data.createdAt)) {
        updates.createdAt = convertToTimestamp(data.createdAt);
        needsUpdate = true;
      }

      // Check date
      if (isDateMap(data.date)) {
        updates.date = convertToTimestamp(data.date);
        needsUpdate = true;
      }

      // Check dueDate
      if (data.dueDate && isDateMap(data.dueDate)) {
        updates.dueDate = convertToTimestamp(data.dueDate);
        needsUpdate = true;
      }

      // Check updatedAt
      if (data.updatedAt && isDateMap(data.updatedAt)) {
        updates.updatedAt = convertToTimestamp(data.updatedAt);
        needsUpdate = true;
      }

      if (needsUpdate) {
        try {
          const billRef = doc(db, 'bills', document.id);
          await updateDoc(billRef, updates);
          
          results.success++;
          results.details.push({
            id: document.id,
            billId,
            action: 'fixed',
            reason: `Converted ${Object.keys(updates).join(', ')} to Timestamp`
          });
          
          console.log(`✅ Fixed ${billId}: ${Object.keys(updates).join(', ')}`);
        } catch (error) {
          results.failed++;
          results.details.push({
            id: document.id,
            billId,
            action: 'failed',
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
          
          console.error(`❌ Failed to fix ${billId}:`, error);
        }
      } else {
        results.skipped++;
        results.details.push({
          id: document.id,
          billId,
          action: 'skipped',
          reason: 'Dates already in correct format'
        });
        
        console.log(`⏭️  Skipped ${billId}: Already correct format`);
      }
    }

    return results;
  } catch (error) {
    console.error('❌ Error fixing date formats:', error);
    throw error;
  }
}

export async function checkDateFormats(): Promise<{
  total: number;
  needsFix: number;
  correct: number;
  bills: Array<{
    id: string;
    billId: string;
    createdAtType: string;
    dateType: string;
    dueDateType: string;
    needsFix: boolean;
    createdAtRaw?: any;
    dateRaw?: any;
    dueDateRaw?: any;
  }>;
}> {
  try {
    const billsRef = collection(db, 'bills');
    const snapshot = await getDocs(billsRef);

    const bills: Array<{
      id: string;
      billId: string;
      createdAtType: string;
      dateType: string;
      dueDateType: string;
      needsFix: boolean;
      createdAtRaw?: any;
      dateRaw?: any;
      dueDateRaw?: any;
    }> = [];

    let needsFix = 0;
    let correct = 0;

    snapshot.docs.forEach(document => {
      const data = document.data();
      const billId = data.billId || document.id;

      const getDateType = (dateValue: any): string => {
        if (!dateValue) return 'missing';
        if (dateValue?.toDate) return 'Timestamp ✅';
        if (isDateMap(dateValue)) return 'Map ❌';
        if (typeof dateValue === 'string') return 'String ❌';
        if (dateValue instanceof Date) return 'Date ❌';
        return 'unknown ❌';
      };

      const createdAtType = getDateType(data.createdAt);
      const dateType = getDateType(data.date);
      const dueDateType = getDateType(data.dueDate);

      const needsFixing = 
        createdAtType.includes('❌') || 
        dateType.includes('❌') || 
        (data.dueDate && dueDateType.includes('❌'));

      if (needsFixing) {
        needsFix++;
      } else {
        correct++;
      }

      bills.push({
        id: document.id,
        billId,
        createdAtType,
        dateType,
        dueDateType,
        needsFix: needsFixing,
        createdAtRaw: data.createdAt,
        dateRaw: data.date,
        dueDateRaw: data.dueDate
      });
    });

    return {
      total: snapshot.size,
      needsFix,
      correct,
      bills
    };
  } catch (error) {
    console.error('Error checking date formats:', error);
    throw error;
  }
}
