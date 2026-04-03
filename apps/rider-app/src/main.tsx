import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from '@popclozet/auth';
import { ToastProvider } from './contexts/ToastContext';
import { LocationProvider } from './contexts/LocationContext';
import App from './App';
import './index.css';

// Register PWA Service Worker
registerSW({
  onNeedRefresh() {
    if (import.meta.env.PROD) {
      window.location.reload();
    } else {
      console.log('New service worker available (dev mode)');
    }
  },
  onOfflineReady() {
    console.log('App ready for offline usage');
  },
  onRegisterError(error) {
    console.error('SW registration error:', error);
  },
});

// Listen for the new service worker taking control
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('🔄 Service Worker updated. Reloading page...');
      window.location.reload();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <LocationProvider>
            <App />
          </LocationProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
