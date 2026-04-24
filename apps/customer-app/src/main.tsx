import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import { initTheme } from "./utils/theme";

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

if (import.meta.env.DEV && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/dev-sw.js", { scope: "/" })
            .then((reg) => console.log("[dev-sw] registered:", reg.scope))
            .catch((err) => console.warn("[dev-sw] registration failed:", err));
    });
}

const container = document.getElementById("root");

if (!container) {
    throw new Error("Root container missing in index.html");
}

createRoot(container).render(
    <HelmetProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
        </BrowserRouter>
    </HelmetProvider>
);

requestAnimationFrame(() => {
    const boot = document.getElementById("__boot");
    if (boot) boot.remove();
});
