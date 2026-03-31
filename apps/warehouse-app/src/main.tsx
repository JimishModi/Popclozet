import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from '@popclozet/auth';
import { ToastProvider } from './contexts/ToastContext';
import App from './App';
import './index.css';

// Register PWA Service Worker
registerSW({
    onNeedRefresh() {
        console.log('[PWA] New content available, reloading...');
        window.location.reload();
    },
    onOfflineReady() {
        console.log('[PWA] App ready for offline usage');
    },
    onRegisterError(error) {
        console.error('[PWA] SW registration error:', error);
    },
});

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
