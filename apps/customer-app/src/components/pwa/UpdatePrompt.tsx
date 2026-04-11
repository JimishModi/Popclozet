// PWA "update available" toast.
//
// VitePWA is currently DISABLED in vite.config.ts (the service worker
// was aggressively caching stale dev bundles). The old implementation
// imported `virtual:pwa-register/react`, a virtual module that only
// exists while the vite-plugin-pwa plugin is registered — so as long
// as VitePWA is off, that import crashes the dev server.
//
// This file is intentionally a no-op stub so `App.tsx` still compiles.
// When you re-enable VitePWA for production, restore the original
// `useRegisterSW`-based implementation from git history.

export function UpdatePrompt() {
    return null;
}
