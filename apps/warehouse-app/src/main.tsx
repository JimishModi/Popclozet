import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from '@popclozet/auth';
import { ToastProvider } from './contexts/ToastContext';
import { hasReloadGuard, setReloadGuard } from './lib/reloadGuard';
import App from './App';
import './index.css';

// Register PWA Service Worker
const updateServiceWorker = registerSW({
    onNeedRefresh() {
        if (import.meta.env.PROD) {
            const reloadKey = 'sw_reload_warehouse_v1';
            if (!hasReloadGuard(reloadKey)) {
                setReloadGuard(reloadKey);
                console.log('[PWA] New content available, reloading once to apply assets');
                window.location.reload();
            } else {
                console.log('[PWA] New content available (already reloaded this session)');
            }
            return;
        }

        console.log('[PWA] New content available (dev mode)');
    },
    onOfflineReady() {
        console.log('[PWA] App ready for offline usage');
    },
    onRegisterError(error) {
        console.error('[PWA] SW registration error:', error);
    },
});

if (import.meta.env.PROD) {
    setInterval(() => {
        if (typeof updateServiceWorker === 'function') {
            void updateServiceWorker(true);
        }
    }, 60 * 60 * 1000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && typeof updateServiceWorker === 'function') {
            void updateServiceWorker(true);
        }
    });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    <App />
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);
