import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Unregister Service Workers in Native environments to resolve caching issues across builds
const w = window as any;
const isNative = w.Capacitor?.isNativePlatform();

if ('serviceWorker' in navigator) {
  if (isNative) {
    // Unregister any active service worker when running in a native wrapper (Capacitor)
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister();
      }
    }).catch(function(err) {
      console.log('Service Worker unregistration failed: ', err);
    });
  } else {
    // Register Service Worker for web/PWA
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
        console.log('SW registered:', registration);
      }).catch(error => {
        console.warn('SW registration failed:', error);
      });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);



