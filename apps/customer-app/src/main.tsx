import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { initTheme } from "./utils/theme";

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

// Service worker registration will be handled by the UpdatePrompt component using useRegisterSW
// (that's production only, via vite-plugin-pwa). In dev we register a minimal stub
// that handles `push` / `notificationclick` events so Web Push can be tested on localhost.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/dev-sw.js", { scope: "/" })
      .then((reg) => console.log("[dev-sw] registered:", reg.scope))
      .catch((err) => console.warn("[dev-sw] registration failed:", err));
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
