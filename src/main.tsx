import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { doc, getDocFromServer } from 'firebase/firestore';
import App from './App.tsx';
import { db } from './lib/firebase';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);



