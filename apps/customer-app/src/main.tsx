import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import { initTheme } from "./utils/theme";
// Apply theme before first paint (correct)
initTheme();

// Restore Supabase session BEFORE React mounts
// (Now handled natively by Supabase persistSession: true)

// Forcefully unregister service workers in development to prevent "Offline Mode" bugs
if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
        console.log("🧹 Unregistered stale service worker in DEV mode");
      }
    });
  }
}

// Register PWA Service Worker (only in production)
if (import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      console.log("🔄 New version available — refresh recommended");
    },
    onOfflineReady() {
      console.log("📦 App ready for offline usage");
    },
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