import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import { initTheme } from "./utils/theme";
import { hasReloadGuard, setReloadGuard } from "./lib/reloadGuard";

// === HashRouter Query Param Rescue ===
const hasHashRoute = window.location.hash.startsWith("#/");
const hasDirectPath = window.location.pathname !== "/";
const hasStandaloneSearch = window.location.search.length > 1;

if (!hasHashRoute && (hasDirectPath || hasStandaloneSearch)) {
  const routePath = window.location.pathname === "/" ? "/" : window.location.pathname;
  const rescuedUrl = `${window.location.origin}/#${routePath}${window.location.search}`;
  window.history.replaceState(null, "", rescuedUrl);
}

// ✅ KEEP THIS → prevents iOS websocket crashes
window.addEventListener("unhandledrejection", (event) => {
  const msg = event?.reason?.message ?? "";
  if (
    msg.includes("The operation is insecure") ||
    msg.includes("WebSocket") ||
    msg.includes("wss://") ||
    msg.includes("ws://")
  ) {
    event.preventDefault();
    console.warn("[popclozet] Realtime WebSocket unavailable (non-fatal):", msg);
  }
});

// Apply theme before first paint
initTheme();

// ─── Service Worker Logic ─────────────────────────────
const shouldAutoReloadForSw = import.meta.env.PROD;
const hadServiceWorkerControllerAtBoot =
  "serviceWorker" in navigator && !!navigator.serviceWorker.controller;

const SW_RELOAD_KEY = `sw_reload_${__SW_VERSION__}`;
let sawServiceWorkerUpdate = false;

const reloadForServiceWorker = (reason: string) => {
  if (hasReloadGuard(SW_RELOAD_KEY)) {
    console.log(`🔄 ${reason} (already reloaded)`);
    return;
  }

  setReloadGuard(SW_RELOAD_KEY);
  console.log(`🔄 ${reason}. Reloading...`);
  window.location.reload();
};

// Register SW
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    sawServiceWorkerUpdate = true;
    if (shouldAutoReloadForSw) {
      console.log("🔄 New SW detected — waiting for takeover...");
    } else {
      console.log("🔄 SW available (dev mode)");
    }
  },
  onOfflineReady() {
    console.log("📦 App ready offline");
  },
  onRegisterError(error) {
    console.error("❌ SW error:", error);
  },
});

// Periodic check
setInterval(() => {
  console.log("🔄 Checking for updates...");
  updateServiceWorker(true);
}, 60 * 60 * 1000);

// Visibility check
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    console.log("🔄 Tab visible — checking updates...");
    updateServiceWorker(true);
  }
});

// Controller change (SAFE VERSION)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!shouldAutoReloadForSw) return;

    const isUpdateTakeover = hadServiceWorkerControllerAtBoot || sawServiceWorkerUpdate;

    if (!isUpdateTakeover) {
      console.log("Skipping reload on first install");
      return;
    }

    reloadForServiceWorker("SW update took control");
  });
}

// ─── React Mount ─────────────────────────────
const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container missing in index.html");
}

createRoot(container).render(
  <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </HashRouter>
);

// Remove boot fallback
requestAnimationFrame(() => {
  const boot = document.getElementById("__boot");
  if (boot) boot.remove();
});