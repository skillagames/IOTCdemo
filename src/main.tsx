import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StatusBar } from '@capacitor/status-bar';
import App from './App.tsx';
import './index.css';

// Fix edge-to-edge issue
StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {
  // Catch error in standard web environments where StatusBar is not available
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);



