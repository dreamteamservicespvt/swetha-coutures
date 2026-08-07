import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * Firebase config, read from environment variables.
 *
 * These values are not secrets in the "must never be seen" sense — a Firebase web config is
 * public by design, and Firestore Security Rules are what actually protect the data. They
 * live in `.env` anyway so the project can be pointed at a different Firebase project
 * (staging, or a restored backup) without editing source, and so nothing about the
 * deployment is baked into the repository.
 *
 * Vite only exposes variables prefixed with `VITE_` to the browser bundle.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Fail loudly at start-up rather than with a confusing "permission denied" later on.
const missing = (['apiKey', 'authDomain', 'projectId', 'appId'] as const).filter(
  (key) => !firebaseConfig[key]
);
if (missing.length > 0) {
  const names = missing.map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);
  throw new Error(
    `Firebase is not configured. Missing environment variable(s): ${names.join(', ')}.\n` +
      'Copy .env.example to .env and fill in the values from your Firebase project settings.'
  );
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
