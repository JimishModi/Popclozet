import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
import { initTheme } from "./utils/theme";
import { authPersistence } from "@/services/authPersistence";
import { ConnectionProvider } from "@/context/ConnectionContext";

// ================================
// PRE-RENDER INITIALIZATION
// ================================

// Apply theme before first paint (correct)
initTheme();

// Restore Supabase session BEFORE React mounts
authPersistence.initialize();

// Register PWA Service Worker (handled by Vite PWA plugin)
registerSW({
  onNeedRefresh() {
    console.log("🔄 New version available — refresh recommended");
  },
  onOfflineReady() {
    console.log("📦 App ready for offline usage");
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
  <ConnectionProvider>
    <HashRouter>
      <App />
    </HashRouter>
  </ConnectionProvider>
);