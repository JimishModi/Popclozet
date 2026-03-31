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

// Register PWA Service Worker (both dev and prod — needed for push notifications)
registerSW({
  onNeedRefresh() {
    if (import.meta.env.PROD) {
      // Guard: only reload ONCE per browser session to prevent infinite loops.
      // On fresh install the new SW activates immediately, which fires onNeedRefresh.
      // Without this guard the page reloads → SW re-claims → fires again → loop.
      const RELOAD_KEY = "sw_reload_done";
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
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