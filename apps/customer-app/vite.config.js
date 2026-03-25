import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    base: "/",
    // Load .env from monorepo root
    envDir: path.resolve(__dirname, "../.."),
    server: {
        host: "localhost",
        port: 5500,
        proxy: {
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true,
                secure: false,
            },
        },
    },
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: [
                "favicon.ico",
                "robots.txt",
                "icons/icon-192x192.png",
                "icons/icon-512x512.png",
                "icons/icon-maskable-192x192.png",
                "icons/icon-maskable-512x512.png",
            ],
            manifest: {
                name: "Pop Clozet - Rent the Trend",
                short_name: "Pop Clozet",
                description: "Rent designer fashion for every occasion. Delivered in 60 minutes.",
                start_url: "/",
                scope: "/",
                display: "standalone",
                orientation: "portrait-primary",
                background_color: "#F6F0E0",
                theme_color: "#F6F0E0",
                categories: ["shopping", "lifestyle", "fashion"],
                icons: [
                    {
                        src: "/icons/icon-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/icons/icon-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/icons/icon-maskable-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "maskable",
                    },
                    {
                        src: "/icons/icon-maskable-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
            workbox: {
                cleanupOutdatedCaches: true,
                skipWaiting: true,
                clientsClaim: true,
                globPatterns: ["**/*.{html,ico,svg,woff,woff2}"],
                runtimeCaching: [
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === "document";
                        },
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "pages-cache",
                        },
                    },
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === "style";
                        },
                        handler: "StaleWhileRevalidate",
                        options: {
                            cacheName: "css-cache",
                        },
                    },
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === "script";
                        },
                        handler: "StaleWhileRevalidate",
                        options: {
                            cacheName: "js-cache",
                        },
                    },
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === "image";
                        },
                        handler: "CacheFirst",
                        options: {
                            cacheName: "images-cache",
                            expiration: {
                                maxEntries: 500,
                                maxAgeSeconds: 30 * 24 * 60 * 60,
                            },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "supabase-api-cache",
                            networkTimeoutSeconds: 3,
                            cacheableResponse: { statuses: [200] },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "supabase-storage-cache",
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 30 * 24 * 60 * 60,
                            },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: "StaleWhileRevalidate",
                        options: {
                            cacheName: "google-fonts-stylesheets",
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "google-fonts-webfonts",
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 365 * 24 * 60 * 60,
                            },
                        },
                    },
                ],
                navigateFallback: "/offline.html",
                navigateFallbackDenylist: [/^\/api/, /^\/admin/],
            },
            devOptions: {
                enabled: false,
            },
        }),
    ],
    /**
     * 🔑 THIS IS WHAT YOU WERE MISSING
     * Monorepo internal package resolution
     */
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@popclozet/domain-contracts": path.resolve(__dirname, "../../packages/domain-contracts/src/index.ts"),
            "@popclozet/api-client": path.resolve(__dirname, "../../packages/api-client/src/index.ts"),
            "@popclozet/auth": path.resolve(__dirname, "../../packages/auth/src/index.tsx"),
            "@popclozet/mapbox-core": path.resolve(__dirname, "../../packages/mapbox-core/src/index.ts"),
            "@popclozet/ui": path.resolve(__dirname, "../../packages/ui/src/index.tsx"),
        },
    },
    optimizeDeps: {
        // Disable dependency pre-bundling to avoid esbuild/spawned-process memory OOM
        // on low-memory/dev Windows environments. This makes cold-starts slower
        // but prevents the esbuild Go runtime from being invoked during dev.
        include: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
        exclude: [
            "@popclozet/api-client",
            "@popclozet/auth",
            "@popclozet/mapbox-core",
        ],
    },
    build: {
        target: "es2020",
        minify: "esbuild",
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ["react", "react-dom", "react-router-dom"],
                    animations: ["framer-motion"],
                },
            },
        },
    },
});
