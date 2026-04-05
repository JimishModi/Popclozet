import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import { initTheme } from "./utils/theme";
import { hasReloadGuard, setReloadGuard } from "./lib/reloadGuard";

// === HashRouter Query Param Rescue ===
// Because we use HashRouter, incoming redirects (like Didit KYC callbacks or Payment callbacks)
// that hit `/?kyc_callback=success` will get stripped when HashRouter mounts and defaults to `/#/`.
// We intercept it before React mounts and rewrite the URL so the params move into the hash.
if (window.location.search && !window.location.hash.includes(window.location.search)) {
  const currentSearch = window.location.search;
  const hashPath = window.location.hash || '#/';
  // Only redirect if there actually are query params
  if (currentSearch.length > 1) {
    const cleanHash = hashPath.split('?')[0]; // strip existing hash queries if any
    const newUrl = window.location.origin + window.location.pathname + cleanHash + currentSearch;
    window.history.replaceState(null, '', newUrl);
  }
}

// ── Global WebSocket error safety net ─────────────────────────────────────
// iOS Safari (Instagram/TikTok WebViews, PWA standalone, private browsing)
// throws DOMException: "The operation is insecure" from WebSocket constructors
// even on wss:// URLs. Catch these at the top level so they never propagate
// as unhandled rejections that could crash the app.
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message ?? '';
  if (
    msg.includes('The operation is insecure') ||
    msg.includes('WebSocket') ||
    msg.includes('wss://') ||
    msg.includes('ws://')
  ) {
    event.preventDefault();
    console.warn('[popclozet] Realtime WebSocket unavailable (non-fatal):', msg);
  }
});

// Apply theme before first paint (correct)
initTheme();

// Restore Supabase session BEFORE React mounts
// (Now handled natively by Supabase persistSession: true)

// Register PWA Service Worker (both dev and prod — needed for push notifications)
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    if (import.meta.env.PROD) {
      // Guard: only reload ONCE per browser session to prevent infinite loops.
      // On fresh install the new SW activates immediately, which fires onNeedRefresh.
      // Without this guard the page reloads → SW re-claims → fires again → loop.
      const RELOAD_KEY = `sw_reload_${__SW_VERSION__}`;
      if (!hasReloadGuard(RELOAD_KEY)) {
        setReloadGuard(RELOAD_KEY);
        console.log("🔄 New service worker — reloading once to apply assets");
        window.location.reload();
      } else {
        console.log("🔄 New service worker available (already reloaded this session)");
      }
    } else {
      console.log("🔄 New service worker available (dev mode — manual reload if needed)");
    }
  },
  onOfflineReady() {
    console.log("📦 App ready for offline usage");
  },
  onRegisterError(error) {
    console.error("❌ SW registration error:", error);
  },
});

// ── Periodic update check (60 minutes) ──────────────────────────────────────
setInterval(() => {
  console.log("🔄 Periodic check for PWA updates...");
  updateServiceWorker(true);
}, 60 * 60 * 1000);

// ── Visibility update check ──────────────────────────────────────────────────
// Check for updates whenever the browser tab becomes visible again
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    console.log("🔄 Tab became visible — checking for PWA updates...");
    updateServiceWorker(true);
  }
});

// ── Controller Change Listener ───────────────────────────────────────────────
// Listen for the new service worker taking control
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      console.log("🔄 Service Worker updated. Reloading page...");
      window.location.reload();
    }
  });
}

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container missing in index.html");
}

// ================================
// REACT ROOT
// ================================

createRoot(container).render(
  <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </HashRouter>
);
