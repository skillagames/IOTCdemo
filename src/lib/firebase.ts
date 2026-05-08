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
async function testConnection() {
  try {
    // We try to get a non-existent doc just to see if we can reach the server
    await getDocFromServer(doc(db, '_internal_', 'connection_test'));
    console.log("Firebase Connected: Handshake successful.");
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firebase Connection Error: The client is offline. Please check your configuration.");
    } else {
      // It might fail with 'not-found' or 'permission-denied' depending on rules, 
      // but if it reaches the rules, it means we are connected.
      console.log("Firebase Connection: Persistence layer reached.");
    }
  }
}

export async function initializeFirebaseConnection() {
  const isFirstLaunchDone = localStorage.getItem('is_first_launch_done');
  
  if (!isFirstLaunchDone) {
    console.log("First launch detected: Forcing Firebase network sync...");
    try {
      // Force a network fetch to prime the connection and cache
      // We use a known document or just the connection test
      await testConnection();
      
      // Also try to pre-fetch global settings if they exist
      const configDoc = doc(db, 'config', 'settings');
      await getDocFromServer(configDoc).catch(() => null);
      
      localStorage.setItem('is_first_launch_done', 'true');
    } catch (e) {
      console.warn("Initial sync failed, but proceeding...", e);
    }
  } else {
    // On subsequent launches, just test connection in the background
    testConnection().catch(console.error);
  }
}
