// Diagnostic Script: Check existing bills in Firebase
// Run this to see what bill IDs currently exist in the database

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA5cV89lhaw0DyYW1JbzdNFy9WPBmovhTc",
  authDomain: "swethacoutures.firebaseapp.com",
  projectId: "swethacoutures",
  storageBucket: "swethacoutures.firebasestorage.app",
  messagingSenderId: "1041019245688",
  appId: "1:1041019245688:web:5a2c24a77bf73b0b39beb8",
  measurementId: "G-3F85DZSK8Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function diagnoseBills() {
  console.log('🔍 Diagnosing bills in Firebase...\n');
  
  try {
    const billsRef = collection(db, 'bills');
    const q = query(billsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    console.log(`📊 Total bills found: ${snapshot.size}\n`);
    
    if (snapshot.size === 0) {
      console.log('✅ No bills found. Database is clean!');
      return;
    }
    
    console.log('📋 Bill Details:\n');
    console.log('─'.repeat(80));
    console.log('Firestore ID'.padEnd(25), '| billId'.padEnd(20), '| billNumber'.padEnd(15), '| Customer');
    console.log('─'.repeat(80));
    
    const billIds = new Map();
    const duplicates = [];
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const firestoreId = doc.id;
      const billId = data.billId || 'MISSING';
      const billNumber = data.billNumber ?? 'MISSING';
      const customer = data.customer?.name || data.customerName || 'Unknown';
      
      // Track duplicates
      if (billIds.has(billId)) {
        duplicates.push(billId);
      }
      billIds.set(billId, (billIds.get(billId) || 0) + 1);
      
      console.log(
        firestoreId.substring(0, 23).padEnd(25),
        '|', String(billId).padEnd(18),
        '|', String(billNumber).padEnd(13),
        '|', customer.substring(0, 30)
      );
    });
    
    console.log('─'.repeat(80));
    console.log('\n📊 Bill ID Analysis:\n');
    
    // Group by format
    const formats = {
      'Bill001 format': [],
      'Hash format (#101)': [],
      'Timestamp format (BILL215896)': [],
      'Missing/Invalid': []
    };
    
    billIds.forEach((count, billId) => {
      if (billId === 'MISSING' || billId === 'undefined' || !billId) {
        formats['Missing/Invalid'].push({ billId, count });
      } else if (billId.startsWith('Bill') && /Bill\d{3,}/.test(billId)) {
        formats['Bill001 format'].push({ billId, count });
      } else if (billId.startsWith('#')) {
        formats['Hash format (#101)'].push({ billId, count });
      } else if (billId.startsWith('BILL') && /BILL\d{6}/.test(billId)) {
        formats['Timestamp format (BILL215896)'].push({ billId, count });
      } else {
        formats['Missing/Invalid'].push({ billId, count });
      }
    });
    
    Object.entries(formats).forEach(([formatName, bills]) => {
      if (bills.length > 0) {
        console.log(`\n${formatName}:`);
        bills.forEach(({ billId, count }) => {
          const warning = count > 1 ? ` ⚠️  DUPLICATE (${count} bills)` : '';
          console.log(`  - ${billId}${warning}`);
        });
      }
    });
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  DUPLICATES FOUND:');
      const uniqueDuplicates = [...new Set(duplicates)];
      uniqueDuplicates.forEach(billId => {
        console.log(`  - ${billId} appears ${billIds.get(billId)} times`);
      });
    }
    
    console.log('\n✅ Diagnosis complete!');
    console.log('\n💡 Recommendations:');
    console.log('   1. If you see duplicates, run the migration script');
    console.log('   2. If formats are inconsistent, run the migration script');
    console.log('   3. Migration script: npm run migrate-bills');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

diagnoseBills();
