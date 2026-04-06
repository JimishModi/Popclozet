import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import { initTheme } from "./utils/theme";
import { hasReloadGuard, setReloadGuard } from "./lib/reloadGuard";

// Because we use HashRouter, callbacks that land on "/?foo=bar" need to be
// rewritten before React mounts or the query string gets dropped.
if (window.location.search && !window.location.hash.includes(window.location.search)) {
  const currentSearch = window.location.search;
  const hashPath = window.location.hash || "#/";
  if (currentSearch.length > 1) {
    const cleanHash = hashPath.split("?")[0];
    const newUrl = window.location.origin + window.location.pathname + cleanHash + currentSearch;
    window.history.replaceState(null, "", newUrl);
  }
}

// Some iOS webviews throw insecure WebSocket errors that should never crash the app.
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

initTheme();

if (import.meta.env.PROD) {
  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      const reloadKey = `sw_reload_${__SW_VERSION__}`;
      if (!hasReloadGuard(reloadKey)) {
        setReloadGuard(reloadKey);
        console.log("New service worker detected, reloading once to apply assets");
        window.location.reload();
      } else {
        console.log("New service worker available (already reloaded this session)");
      }
    },
    onOfflineReady() {
      console.log("App ready for offline usage");
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  setInterval(() => {
    console.log("Checking for PWA updates...");
    updateServiceWorker(true);
  }, 60 * 60 * 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      console.log("Tab became visible, checking for PWA updates...");
      updateServiceWorker(true);
    }
  });

  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        console.log("Service worker updated, reloading page");
        window.location.reload();
      }
    });
  }
}

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container missing in index.html");
}

createRoot(container).render(
  <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </HashRouter>
);
