import express from 'express';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy initialization of Firebase Admin to avoid startup crash if creds are missing
let adminInitialized = false;
function initAdmin() {
  if (!adminInitialized && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Replace literal \n with actual newlines for the private key
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          })
        });
      }
      adminInitialized = true;
    } catch (e) {
      console.error("Firebase Admin Init Error:", e);
    }
  }
  return adminInitialized;
}

app.post('/api/push', async (req, res) => {
  if (!initAdmin()) {
    return res.status(500).json({ error: 'Firebase Admin not configured. Needs FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY secrets.' });
  }

  try {
    const { token, title, body } = req.body;
    
    if (!token) return res.status(400).json({ error: 'Missing token' });

    // Provide default safe fallbacks to prevent undefined payload crash
    const safeTitle = title || 'Device Alert';
    const safeBody = body || 'Check your devices.';

    const pushTargetId = 'test_' + Date.now();
    const message = {
      notification: { 
        title: safeTitle, 
        body: safeBody 
      },
      data: {
        targetId: pushTargetId
      },
      token: token,
      android: {
        priority: 'high' as const,
        notification: {
            title: safeTitle,
            body: safeBody,
            sound: 'default'
        }
      }
    };

    const response = await admin.messaging().send(message);
    res.json({ success: true, response });
  } catch (error: any) {
    console.error('FCM V1 Send Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/firebase-push', async (req, res) => {
  if (!initAdmin()) {
    return res.status(500).json({ error: 'Firebase Admin not configured. Needs FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY secrets.' });
  }

  try {
    const { token, title, body } = req.body;
    
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const safeTitle = title || 'Test Firebase Notification';
    const safeBody = body || 'This is exactly like a Firebase Console push.';

    // Send a pure simple message like the Firebase Console does, targeting the Android app
    const message = {
      notification: { 
        title: safeTitle, 
        body: safeBody 
      },
      android: {
        restrictedPackageName: 'Iot.connect.app',
        notification: {
          sound: 'default'
        }
      },
      token: token
    };

    const response = await admin.messaging().send(message);
    res.json({ success: true, response });
  } catch (error: any) {
    console.error('Firebase Push Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/icon-push-test', async (req, res) => {
  if (!initAdmin()) {
    return res.status(500).json({ error: 'Firebase Admin not configured. Needs FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY secrets.' });
  }

  try {
    const { token, title, body } = req.body;
    
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const safeTitle = title || 'Hello';
    const safeBody = body || 'Awesome update!';

    const message = {
      notification: {
        title: safeTitle,
        body: safeBody
        // no icon here
      },
      android: {
        notification: {
          // Do NOT specify icon here so AndroidManifest default is used
          color: '#000000'
        }
      },
      webpush: {
        notification: {
          // No icon URL for web either
        }
      },
      token: token
    };

    const response = await admin.messaging().send(message);
    res.json({ success: true, response });
  } catch (error: any) {
    console.error('Firebase Push Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const MASTER_DEVICES = [
  {
    serialNumber: "6001237010828",
    imei: "358762109845321",
    iccid: "89014103211185101234",
    model: "IoT-Hub-X1",
    manufacturer: "IoTConnect Labs",
  },
  {
    imei: "869816053499231",
    serialNumber: "K78038990",
    materialCode: "303201410",
    barcode: "6931847166557",
    model: "DS-MCW407",
    description: "Body Camera",
    manufacturer: "Hikvision",
  },
  {
    serialNumber: "Q44112434",
    imei: "358762109845777",
    iccid: "89014103211185109999",
    materialCode: "302401688",
    barcode: "6941264054313",
    model: "DS-PWA96-M-WE",
    description: "HIKVISION AX PRO",
    manufacturer: "Hikvision",
  },
  {
    serialNumber: "CK2144765",
    imei: "867806072755749",
    barcode: "6975248490460",
    materialCode: "307900723",
    model: "AE-DI5052-G40 PRO",
    description: "HIKVISION DashCam",
    manufacturer: "Hikvision",
  },
  {
    serialNumber: "869247060300081",
    imei: "869247060300081",
    model: "Jimi IoT 4G Al DashCam",
    description: "Jimi IoT 4G Al DashCam",
    manufacturer: "JimiIoT",
  },
  {
    serialNumber: "BF00278PAJ00001",
    imei: "865622075263116",
    iccid: "89014103211185002781",
    model: "DHI-ARC3800H-FW2(868)",
    description: "DAHUA Alarm Hub",
    manufacturer: "DAHUA VISION TECHNOLOGY",
  }
];

async function seedMasterRegistry() {
  if (!initAdmin()) {
    console.log("Skipping seedMasterRegistry: Firebase Admin not configured yet.");
    return;
  }
  try {
    const db = admin.firestore();
    const registryRef = db.collection("master_registry");
    const devicesRef = db.collection("devices");

    for (const deviceData of MASTER_DEVICES) {
      const q = registryRef.where("serialNumber", "==", deviceData.serialNumber);
      const snapshot = await q.get();

      if (snapshot.empty) {
        await registryRef.add({
          ...deviceData,
          lastSeeded: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[Server] Seeded device ${deviceData.serialNumber} into master registry.`);
      } else {
        const docId = snapshot.docs[0].id;
        await registryRef.doc(docId).update({
          description: deviceData.description || null,
          model: deviceData.model,
          manufacturer: deviceData.manufacturer,
          lastSeeded: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // Proactive migration check for older dummy data (optional but ensures backwards compatibility)
    try {
      const migrations = [
        {
          queries: [
            devicesRef.where("serialNumber", "==", "869247060300081"),
            devicesRef.where("imei", "==", "869247060300081")
          ],
          update: { name: "Jimi IoT 4G Al DashCam", description: "Jimi IoT 4G Al DashCam", manufacturer: "JimiIoT" }
        },
        {
          queries: [
            devicesRef.where("serialNumber", "==", "BF00278PAJ00001"),
            devicesRef.where("serialNumber", "==", "BF0O278PAJ00001"),
            devicesRef.where("imei", "==", "865622075263116")
          ],
          update: { description: "DAHUA Alarm Hub", model: "DHI-ARC3800H-FW2(868)", manufacturer: "DAHUA VISION TECHNOLOGY" }
        },
        {
          queries: [
            devicesRef.where("model", "==", "AE-DI5052-G40 PRO"),
            devicesRef.where("serialNumber", "==", "CK2144765")
          ],
          update: { description: "HIKVISION DashCam", manufacturer: "Hikvision" }
        }
      ];

      for (const mig of migrations) {
        for (const q of mig.queries) {
          const snap = await q.get();
          for (const doc of snap.docs) {
            await doc.ref.update({
              ...mig.update,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }
    } catch (migErr) {
      console.warn("[Server] Could not run data migration on seeding:", migErr);
    }
    console.log("[Server] Master database registry synced from server centrally!");
  } catch (e) {
    console.warn("[Server] Master Registry Sync failed.", e);
  }
}

async function startServer() {
  // Run seeding on startup
  seedMasterRegistry();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
