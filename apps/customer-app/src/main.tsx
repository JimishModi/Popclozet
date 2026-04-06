import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import { initTheme } from "./utils/theme";
import { hasReloadGuard, setReloadGuard } from "./lib/reloadGuard";

// === HashRouter Query Param Rescue ===
// Because we use HashRouter, direct-path callbacks like `/profile?kyc_callback=...`
// need to be rewritten to `/#/profile?kyc_callback=...` before React Router mounts.
const hasHashRoute = window.location.hash.startsWith("#/");
const hasDirectPath = window.location.pathname !== "/";
const hasStandaloneSearch = window.location.search.length > 1;

if (!hasHashRoute && (hasDirectPath || hasStandaloneSearch)) {
  const routePath = window.location.pathname === "/" ? "/" : window.location.pathname;
  const rescuedUrl = `${window.location.origin}/#${routePath}${window.location.search}`;
  window.history.replaceState(null, "", rescuedUrl);
}

// Apply theme before first paint (correct)
initTheme();

// Restore Supabase session BEFORE React mounts
// (Now handled natively by Supabase persistSession: true)

const shouldAutoReloadForSw = import.meta.env.PROD;
const hadServiceWorkerControllerAtBoot =
  "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
const SW_RELOAD_KEY = `sw_reload_${__SW_VERSION__}`;
let sawServiceWorkerUpdate = false;

const reloadForServiceWorker = (reason: string) => {
  if (hasReloadGuard(SW_RELOAD_KEY)) {
    console.log(`🔄 ${reason} (already reloaded for this version)`);
    return;
  }

  setReloadGuard(SW_RELOAD_KEY);
  console.log(`🔄 ${reason}. Reloading page...`);
  window.location.reload();
};

// Register PWA Service Worker (both dev and prod — needed for push notifications)
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    sawServiceWorkerUpdate = true;
    if (shouldAutoReloadForSw) {
      console.log("🔄 New service worker detected — waiting for takeover...");
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
// Reload only when an actual update takes over. The first claim on a fresh install
// should not trigger a reload, since that is what can blank the first iOS PWA launch.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!shouldAutoReloadForSw) {
      console.log("🔄 SW controllerchange detected (dev mode — skipping auto reload)");
      return;
    }

    const isUpdateTakeover = hadServiceWorkerControllerAtBoot || sawServiceWorkerUpdate;

    if (!isUpdateTakeover) {
      console.log("🔄 SW controllerchange on first install — skipping reload");
      return;
    }

    reloadForServiceWorker("Service worker update took control");
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

// Remove the boot fallback after React mounts so it doesn't overlap the app
requestAnimationFrame(() => {
  const boot = document.getElementById("__boot");
  if (boot) boot.remove();
});
