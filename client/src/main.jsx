import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './pwa';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* instalacja PWA nie blokuje aplikacji */
  });
}

try {
  if (localStorage.getItem('filips-crm-theme') === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
} catch {
  /* ignore */
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
