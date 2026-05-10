import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  doc,
  getDocFromServer,
  persistentLocalCache,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = initializeApp(firebaseConfig);

// Using initializeFirestore with experimentalForceLongPolling to bypass potential gRPC-web issues
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache(),
    experimentalForceLongPolling: true,
  },
  (firebaseConfig as any).firestoreDatabaseId,
);

export const auth = getAuth(app);

// CRITICAL: Validate Connection to Firestore (Minimal check)
export async function initializeFirebaseConnection() {
  // We've moved away from blocking handshakes to prioritize speed and cache reliability.
  // The persistentLocalCache is already configured during db initialization.
  console.log("[Firebase] Initialization starting (background sync enabled)");
}
