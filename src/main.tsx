import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';

// Register Service Worker for PWA/Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
      console.log('SW registered:', registration);
    }).catch(error => {
      console.warn('SW registration failed:', error);
    });
  });
}

// Native configurations (Status bar, Double back to exit, etc.) applied before the app starts
const initNative = async () => {
  const w = window as any;
  if (w.Capacitor?.isNativePlatform()) {
    try {
      // Wait for Status Bar configuration (disables edge-to-edge / overlay behavior)
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Light });
      
      // Double back to exit handler (often requested for Android)
      let lastBackPress = 0;
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          const now = Date.now();
          if (now - lastBackPress < 2000) {
            CapacitorApp.exitApp();
          } else {
            lastBackPress = now;
            // Native UI toast could be handled automatically or manually,
            // but for now we simply allow double-tap to kill app.
          }
        } else {
          window.history.back();
        }
      });
      
    } catch (e) {
      console.warn('Native configuration failed:', e);
    }
  }
};

// Ensure all native configurations are applied before rendering the actual app
initNative().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  
  // Hide splash screen after React mounts if on native platform
  const w = window as any;
  if (w.Capacitor?.isNativePlatform()) {
    import('@capacitor/splash-screen').then(({ SplashScreen }) => {
      setTimeout(() => SplashScreen.hide(), 100);
    }).catch(e => console.warn('Splash screen plugin not available or failed:', e));
  }
});


