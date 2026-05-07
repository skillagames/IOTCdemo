import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);

// We mount the app immediately, but any heavy "native" logic 
// inside App.tsx or AuthContext.tsx will now have a cleaner environment.
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);



