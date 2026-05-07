import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { doc, getDocFromServer } from 'firebase/firestore';
import App from './App.tsx';
import { db } from './lib/firebase';
import './index.css';

async function startApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  const APP_INIT_KEY = 'app_sync_v3';
  const isFirstLaunch = !localStorage.getItem(APP_INIT_KEY);

  // BLOCKING Handshake on first launch to force WebView connection stability
  if (isFirstLaunch) {
    const startTime = Date.now();
    try {
      // Prime the connection with a network request
      await getDocFromServer(doc(db, '_internal_', 'warmup')).catch(() => null);
    } finally {
      const elapsed = Date.now() - startTime;
      const MIN_WAIT = 4000; // 4 seconds to ensure WebView sets its window flags correctly
      if (elapsed < MIN_WAIT) {
        await new Promise(resolve => setTimeout(resolve, MIN_WAIT - elapsed));
      }
      localStorage.setItem(APP_INIT_KEY, 'true');
    }
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

startApp();



