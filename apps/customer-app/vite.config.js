import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";
// import basicSsl from "@vitejs/plugin-basic-ssl";
// ESM doesn't define __dirname — derive it from import.meta.url.
var __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // Load env file from this app's own directory (per-app secrets, no key sharing).
    var env = loadEnv(mode, __dirname, '');
    return {
        base: "/",
        envDir: __dirname,
        define: {
            __SW_VERSION__: JSON.stringify(Date.now().toString(36)),
        },
        server: {
            host: true,
            port: 5500,
        },
        plugins: [
            // basicSsl(),  // Phone testing over LAN: keep HTTP. Self-signed certs
            //              // get rejected by modern mobile browsers; HTTPS-only
            //              // features (GPS, SW, Razorpay) need a proper cert
            //              // (mkcert) or a Vercel preview URL.
            react(),
            // Service worker lives at public/sw.js (plain JS, no build step).
            // In dev mode, main.tsx registers public/dev-sw.js for push testing.
            // In production, UpdatePrompt.tsx registers /sw.js via workbox-window.
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
