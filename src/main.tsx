import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeFirebaseConnection } from './lib/firebase';

async function bootstrap() {
  try {
    await initializeFirebaseConnection();
  } catch (e) {
    console.error("Failed to initialize Firebase connection:", e);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();



