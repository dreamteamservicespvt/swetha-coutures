// Migration Script: Update existing bills to new Bill001 format
// This will reassign bill IDs sequentially starting from Bill001

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import readline from 'readline';

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

function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function migrateBills() {
  console.log('🔄 Bill Migration Script\n');
  console.log('This script will:');
  console.log('  1. Fetch all existing bills (ordered by creation date)');
  console.log('  2. Reassign bill IDs sequentially: Bill001, Bill002, Bill003...');
  console.log('  3. Update billNumber field to match (1, 2, 3...)');
  console.log('  4. Keep the oldest bills with the lowest numbers\n');
  
  console.log('⚠️  WARNING: This will change existing bill IDs!');
  console.log('   Make sure you have a backup before proceeding.\n');
  
  const answer = await askQuestion('Do you want to continue? (yes/no): ');
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Migration cancelled.');
    process.exit(0);
  }
  
  try {
    console.log('\n📥 Fetching bills from Firebase...');
    
    const billsRef = collection(db, 'bills');
    const q = query(billsRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    
    console.log(`📊 Found ${snapshot.size} bills to migrate\n`);
    
    if (snapshot.size === 0) {
      console.log('✅ No bills to migrate!');
      return;
    }
    
    console.log('🔄 Starting migration...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    const updates = [];
    
    snapshot.docs.forEach((document, index) => {
      const billNumber = index + 1;
      const newBillId = `Bill${billNumber.toString().padStart(3, '0')}`;
      
      updates.push({
        firestoreId: document.id,
        oldBillId: document.data().billId || 'MISSING',
        newBillId,
        billNumber
      });
    });
    
    console.log('📋 Migration Plan:\n');
    console.log('─'.repeat(70));
    console.log('Firestore ID'.padEnd(25), '| Old Bill ID'.padEnd(20), '| New Bill ID');
    console.log('─'.repeat(70));
    
    updates.forEach(({ firestoreId, oldBillId, newBillId }) => {
      console.log(
        firestoreId.substring(0, 23).padEnd(25),
        '|', String(oldBillId).padEnd(18),
        '|', newBillId
      );
    });
    
    console.log('─'.repeat(70));
    console.log('');
    
    const confirmAnswer = await askQuestion('Proceed with these changes? (yes/no): ');
    
    if (confirmAnswer.toLowerCase() !== 'yes') {
      console.log('❌ Migration cancelled.');
      process.exit(0);
    }
    
    console.log('\n🚀 Applying updates...\n');
    
    for (const update of updates) {
      try {
        const billRef = doc(db, 'bills', update.firestoreId);
        await updateDoc(billRef, {
          billId: update.newBillId,
          billNumber: update.billNumber
        });
        
        console.log(`✅ ${update.firestoreId.substring(0, 20)}... → ${update.newBillId}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to update ${update.firestoreId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log(`\n✅ Migration complete!`);
    console.log(`   - Successfully updated: ${successCount} bills`);
    if (errorCount > 0) {
      console.log(`   - Errors: ${errorCount} bills`);
    }
    console.log('\n💡 Next steps:');
    console.log('   1. Refresh your application');
    console.log('   2. Verify bills show correct sequential IDs');
    console.log('   3. Test creating a new bill to continue sequence');
    
  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    console.error(error);
  }
}

migrateBills();
