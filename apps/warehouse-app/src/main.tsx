import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from '@popclozet/auth';
import { ToastProvider } from './contexts/ToastContext';
import App from './App';
import { UpdatePrompt } from './components/pwa/UpdatePrompt';
import './index.css';

// === HashRouter Query Param Rescue ===
// iOS Capacitor launches the app at capacitor://localhost/ which breaks
// BrowserRouter history lookups and leaves the root blank. Rewrite any
// legacy path/search URLs into hash form before React mounts.
const hasHashRoute = window.location.hash.startsWith('#/');
const hasDirectPath = window.location.pathname !== '/';
const hasStandaloneSearch = window.location.search.length > 1;

if (!hasHashRoute && (hasDirectPath || hasStandaloneSearch)) {
    const routePath = window.location.pathname === '/' ? '/' : window.location.pathname;
    const rescuedUrl = `${window.location.origin}/#${routePath}${window.location.search}`;
    window.history.replaceState(null, '', rescuedUrl);
}

// Prevent iOS WKWebView from crashing the app on realtime WebSocket failures
window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message ?? '';
    if (
        msg.includes('The operation is insecure') ||
        msg.includes('WebSocket') ||
        msg.includes('wss://') ||
        msg.includes('ws://')
    ) {
        event.preventDefault();
        console.warn('[popclozet-warehouse] Realtime WebSocket unavailable (non-fatal):', msg);
    }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
                <ToastProvider>
                    <App />
                    <UpdatePrompt />
                </ToastProvider>
            </AuthProvider>
        </HashRouter>
    </React.StrictMode>
);
