import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from '@popclozet/auth';
import { ToastProvider } from './contexts/ToastContext';
import { LocationProvider } from './contexts/LocationContext';
import { hasReloadGuard, setReloadGuard } from './lib/reloadGuard';
import App from './App';
import './index.css';

// Register PWA Service Worker
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    if (import.meta.env.PROD) {
      // Guard: only reload ONCE per browser session to prevent infinite loops.
      // This is critical for riders on unstable connections where SW might
      // repeatedly try to claim control.
      const RELOAD_KEY = `sw_reload_rider_v1`; // In a real app, this could include a version hash
      if (!hasReloadGuard(RELOAD_KEY)) {
        setReloadGuard(RELOAD_KEY);
        console.log('🔄 New service worker available — reloading once to apply assets');
        window.location.reload();
      } else {
        console.log('🔄 New service worker available (already reloaded this session)');
      }
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

// ── Periodic update check (60 minutes) ──────────────────────────────────────
setInterval(() => {
  console.log('🔄 Periodic check for PWA updates...');
  if (typeof updateServiceWorker === 'function') {
    (updateServiceWorker as (reload?: boolean) => Promise<void>)(true);
  }
}, 60 * 60 * 1000);

// ── Visibility update check ──────────────────────────────────────────────────
// Check for updates whenever the rider re-opens the app tab
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('🔄 App became visible — checking for PWA updates...');
    if (typeof updateServiceWorker === 'function') {
      (updateServiceWorker as (reload?: boolean) => Promise<void>)(true);
    }
  }
});

// NOTE: Do NOT add a controllerchange → window.location.reload() listener here.
// registerSW({ onNeedRefresh }) above already handles SW updates with the reload guard.
// A redundant controllerchange listener fires an extra reload mid-session,
// which interrupts the auth bootstrap and logs riders out unexpectedly.

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
