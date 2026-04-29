import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

// Using initializeFirestore with experimentalForceLongPolling to bypass potential gRPC-web issues
export const db = initializeFirestore(app, {
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
testConnection();
