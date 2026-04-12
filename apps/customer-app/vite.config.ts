import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// VitePWA is intentionally DISABLED in dev to stop the service worker
// from caching stale bundles. Re-enable only for production builds.
// import { VitePWA } from "vite-plugin-pwa";
// import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(({ mode }) => {
  // Load env file from the current directory
  const env = loadEnv(mode, path.resolve(__dirname, '../../'), '');


  return {
    base: "/",
    // Point specifically to the current directory for .env files
    envDir: "../../",

    define: {
      __SW_VERSION__: JSON.stringify(Date.now().toString(36)),
    },

    server: {
      host: true,
      port: 5500,
      proxy: {
        // Mirror the Vercel /img/* rewrite for local dev
        '/img': {
          target: 'https://hfcdvcpgpkdgmcakgiuy.supabase.co/storage/v1/render/image/public',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/img/, ''),
        },
      },
    },

    plugins: [
      // basicSsl(),
      react(),

      // VitePWA disabled — service worker aggressively cached stale
      // JS bundles during `npm run dev`, blocking new frontend code
      // from reaching the browser. Re-register explicitly when
      // reintroducing PWA support, and keep `devOptions.enabled: false`.
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
