import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

export function initializeFirebase() {
  if (!getApps().length) {
    let firebaseApp;
    try {
      firebaseApp = initializeApp();
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }

    // Initialize Firestore with memory cache and forced long-polling
    // Memory cache avoids "Failed to obtain primary lease" errors
    // Long-polling is required because WebSockets are blocked in this environment
    let firestore;
    try {
      firestore = initializeFirestore(firebaseApp, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
      });
      console.log('✅ Firestore initialized with memory cache and long polling');
    } catch (e) {
      // Fallback or if already initialized
      console.warn('⚠️ Firestore initialization error or already initialized:', e);
      firestore = getFirestore(firebaseApp);
      console.log('⚠️ Using default Firestore instance');
    }

    return {
      firebaseApp,
      auth: getAuth(firebaseApp),
      firestore
    };
  }

  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';