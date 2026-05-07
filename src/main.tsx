import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

setTimeout(async () => {
  const App = (await import('./App.tsx')).default;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}, 250);



