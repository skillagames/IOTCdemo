import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, persistentLocalCache } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

// Using initializeFirestore with experimentalForceLongPolling to bypass potential gRPC-web issues
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);

// CRITICAL: Validate Connection to Firestore
async function testConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await getDocFromServer(doc(db, '_internal_', 'connection_test'));
      console.log("Firebase Connected: Handshake successful.");
      return true;
    } catch (error) {
      console.warn(`Firebase Connection attempt ${i + 1} failed: ${error}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

export async function initializeFirebaseConnection() {
  const isFirstLaunchDone = localStorage.getItem('is_first_launch_done');
  
  if (!isFirstLaunchDone) {
    console.log("First launch detected: Forcing Firebase network sync...");
    try {
      await testConnection(5); // Be more persistent on first launch
      
      const configDoc = doc(db, 'config', 'settings');
      await getDocFromServer(configDoc).catch(() => null);
      
      localStorage.setItem('is_first_launch_done', 'true');
    } catch (e) {
      console.warn("Initial sync failed, but proceeding...", e);
    }
  } else {
    // Non-blocking background check on subsequent launches
    testConnection(1).catch(() => {});
  }
}
