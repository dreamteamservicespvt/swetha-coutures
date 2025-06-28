
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCaSk3dgYazuxA1tSXljsbovDtrxVqmuYU",
  authDomain: "swetha-couture.firebaseapp.com",
  projectId: "swetha-couture",
  storageBucket: "swetha-couture.firebasestorage.app",
  messagingSenderId: "644658026072",
  appId: "1:644658026072:web:d01be387914959c7215c2d",
  measurementId: "G-Y391NZ4Q7C"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
