import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // Load env file from the monorepo root
    var envDir = path.resolve(__dirname, "../..");
    var env = loadEnv(mode, envDir, '');
    console.log("🔍 [Vite Config] Mode:", mode);
    console.log("🔍 [Vite Config] Working Directory:", process.cwd());
    console.log("🔍 [Vite Config] MSG91 Widget ID present:", !!env.VITE_MSG91_WIDGET_ID);
    console.log("🔍 [Vite Config] Supabase URL present:", !!env.VITE_SUPABASE_URL);
    return {
        base: "/",
        // Load .env from monorepo root
        envDir: envDir,
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
                    name: "PopClozet - Rent the Trend",
                    short_name: "PopClozet",
                    description: "Rent designer fashion for every occasion. PopClozet delivers premium outfits in 60 minutes.",
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
                strategies: "injectManifest",
                srcDir: "src",
                filename: "sw.ts",
                injectManifest: {
                    globPatterns: ["**/*.{js,css,html,ico,svg,woff,woff2}"],
                    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
                },
                devOptions: {
                    enabled: true,
                    type: "module",
                },
            }),
        ],
        /**
         * 🔑 Monorepo internal package resolution
         */
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
                "@popclozet/domain-contracts": path.resolve(__dirname, "../../packages/domain-contracts/src/index.ts"),
                "@popclozet/api-client": path.resolve(__dirname, "../../packages/api-client/src/index.ts"),
                "@popclozet/auth": path.resolve(__dirname, "../../packages/auth/src/index.tsx"),
                "@popclozet/map-core": path.resolve(__dirname, "../../packages/map-core/src/index.ts"),
                "@popclozet/ui": path.resolve(__dirname, "../../packages/ui/src/index.tsx"),
            },
        },
        optimizeDeps: {
            include: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
            exclude: [
                "@popclozet/api-client",
                "@popclozet/auth",
                "@popclozet/map-core",
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
    };
});
