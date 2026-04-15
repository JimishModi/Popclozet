/**
 * PWA "update available" toast + service worker registration.
 *
 * Uses workbox-window to register the production service worker
 * (built by VitePWA's injectManifest strategy from src/sw.ts).
 *
 * In dev mode (import.meta.env.DEV), registration is skipped because
 * main.tsx already registers the lightweight /dev-sw.js stub for push
 * testing, and VitePWA's devOptions.enabled is false.
 */

import { useEffect, useState, useCallback } from "react";
import { Workbox } from "workbox-window";

let wb: Workbox | null = null;

export function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    // Only register the production SW (dev uses dev-sw.js via main.tsx)
    if (import.meta.env.DEV) return;
    if (!("serviceWorker" in navigator)) return;

    wb = new Workbox("/sw.js");

    // When a new SW is installed and waiting, show the update banner
    wb.addEventListener("waiting", () => {
      console.log("[PWA] New service worker waiting — update available");
      setShowUpdate(true);
    });

    wb.addEventListener("controlling", () => {
      // New SW took over — reload to get fresh assets
      window.location.reload();
    });

    wb.register()
      .then((reg) => {
        console.log("[PWA] Service worker registered:", reg?.scope);
      })
      .catch((err) => {
        console.warn("[PWA] Service worker registration failed:", err);
      });
  }, []);

  const handleUpdate = useCallback(() => {
    if (!wb) return;
    // Tell the waiting SW to skip waiting and activate
    wb.messageSkipWaiting();
    setShowUpdate(false);
  }, []);

  if (!showUpdate) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        background: "rgba(15,15,15,0.95)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        maxWidth: "90vw",
      }}
    >
      <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>
        New version available
      </span>
      <button
        onClick={handleUpdate}
        style={{
          background: "#f2546d",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "8px 16px",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Update
      </button>
    </div>
  );
}

