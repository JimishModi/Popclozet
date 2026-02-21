import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import { initTheme } from "./utils/theme";
import { authPersistence } from "@/services/authPersistence";

// ================================
// PRE-RENDER INITIALIZATION
// ================================

// Initialize theme before app render
initTheme();

// Initialize auth persistence ONCE (correct place)
authPersistence.initialize();

// Register Service Worker (Vite PWA managed)
// DO NOT manually register /sw.js
registerSW({
  onNeedRefresh() {
    console.log("New version available. Refresh to update.");
  },
  onOfflineReady() {
    console.log("App is ready to work offline.");
  },
});

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container missing in index.html");
}

createRoot(container).render(
  <HashRouter>
    <App />
  </HashRouter>
);
