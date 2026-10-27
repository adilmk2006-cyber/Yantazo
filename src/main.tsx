import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support: cache the app after the first visit (production builds only;
// the single-file build is already self-contained and has no worker to register).
if (import.meta.env.PROD && import.meta.env.MODE !== 'singlefile' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline caching is optional; the game works without it */
    });
  });
}
