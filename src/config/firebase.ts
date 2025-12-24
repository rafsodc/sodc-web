import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Optional: only load Analytics in the browser and only if a measurementId is provided.
// This avoids errors in dev/test environments and keeps the base setup simple.
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

// IMPORTANT:
// - For Vite, env vars must start with VITE_
// - Put these in a .env file (do not commit it) or define them in your CI.
//
// Example:
// VITE_FIREBASE_API_KEY=...
// VITE_FIREBASE_AUTH_DOMAIN=...
// VITE_FIREBASE_PROJECT_ID=...
// VITE_FIREBASE_APP_ID=...
// VITE_FIREBASE_MEASUREMENT_ID=...
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// Lazily initialised Analytics (optional)
let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsPromise) return analyticsPromise;

  analyticsPromise = (async () => {
    // Only attempt analytics in a browser context
    if (typeof window === "undefined") return null;
    if (!firebaseConfig.measurementId) return null;

    const supported = await isSupported();
    if (!supported) return null;

    return getAnalytics(firebaseApp);
  })();

  return analyticsPromise;
}