import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeFirebaseConnection } from './lib/firebase';

async function bootstrap() {
  try {
    // Force the critical Firebase sync before the app even starts rendering its first frame
    console.log('[Main] Bootstrapping Firebase connection...');
    await initializeFirebaseConnection();
  } catch (e) {
    console.error("[Main] Bootstrap sync failed:", e);
  }

  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
}

bootstrap();



