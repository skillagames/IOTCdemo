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

async function startServer() {
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
