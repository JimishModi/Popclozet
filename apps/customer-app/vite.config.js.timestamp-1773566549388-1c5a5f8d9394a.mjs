// vite.config.js
import { defineConfig } from "file:///D:/PopClozet/PopCLozet-Apps/node_modules/.pnpm/vite@5.4.21_@types+node@22.19.13_terser@5.46.0/node_modules/vite/dist/node/index.js";
import react from "file:///D:/PopClozet/PopCLozet-Apps/node_modules/.pnpm/@vitejs+plugin-react-swc@3._2f850774a0190e1fac050680b4735de9/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { VitePWA } from "file:///D:/PopClozet/PopCLozet-Apps/node_modules/.pnpm/vite-plugin-pwa@1.2.0_vite@_00e7eeb9e830952bcf4fc6e8489f305b/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "D:\\PopClozet\\PopCLozet-Apps\\apps\\customer-app";
var vite_config_default = defineConfig({
  base: "/",
  // Load .env from monorepo root
  envDir: path.resolve(__vite_injected_original_dirname, "../.."),
  server: {
    host: "::",
    port: 5500
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
        "icons/icon-maskable-512x512.png"
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
            purpose: "any"
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icons/icon-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/icons/icon-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{html,ico,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: function(_a) {
              var request = _a.request;
              return request.destination === "document";
            },
            handler: "NetworkFirst",
            options: {
              cacheName: "pages-cache"
            }
          },
          {
            urlPattern: function(_a) {
              var request = _a.request;
              return request.destination === "style";
            },
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "css-cache"
            }
          },
          {
            urlPattern: function(_a) {
              var request = _a.request;
              return request.destination === "script";
            },
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "js-cache"
            }
          },
          {
            urlPattern: function(_a) {
              var request = _a.request;
              return request.destination === "image";
            },
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets"
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 365 * 24 * 60 * 60
              }
            }
          }
        ],
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api/, /^\/admin/]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  /**
   * 🔑 THIS IS WHAT YOU WERE MISSING
   * Monorepo internal package resolution
   */
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@popclozet/api-client": path.resolve(__vite_injected_original_dirname, "../../packages/api-client/src"),
      "@popclozet/auth": path.resolve(__vite_injected_original_dirname, "../../packages/auth/src"),
      "@popclozet/mapbox-core": path.resolve(__vite_injected_original_dirname, "../../packages/mapbox-core/src")
    }
  },
  optimizeDeps: {
    // Disable dependency pre-bundling to avoid esbuild/spawned-process memory OOM
    // on low-memory/dev Windows environments. This makes cold-starts slower
    // but prevents the esbuild Go runtime from being invoked during dev.
    include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
    exclude: [
      "@popclozet/api-client",
      "@popclozet/auth",
      "@popclozet/mapbox-core"
    ]
  },
  build: {
    target: "es2020",
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          animations: ["framer-motion"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQb3BDbG96ZXRcXFxcUG9wQ0xvemV0LUFwcHNcXFxcYXBwc1xcXFxjdXN0b21lci1hcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFBvcENsb3pldFxcXFxQb3BDTG96ZXQtQXBwc1xcXFxhcHBzXFxcXGN1c3RvbWVyLWFwcFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovUG9wQ2xvemV0L1BvcENMb3pldC1BcHBzL2FwcHMvY3VzdG9tZXItYXBwL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICAgIGJhc2U6IFwiL1wiLFxyXG4gICAgLy8gTG9hZCAuZW52IGZyb20gbW9ub3JlcG8gcm9vdFxyXG4gICAgZW52RGlyOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uLy4uXCIpLFxyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgICAgaG9zdDogXCI6OlwiLFxyXG4gICAgICAgIHBvcnQ6IDU1MDAsXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICAgIHJlYWN0KCksXHJcbiAgICAgICAgVml0ZVBXQSh7XHJcbiAgICAgICAgICAgIHJlZ2lzdGVyVHlwZTogXCJhdXRvVXBkYXRlXCIsXHJcbiAgICAgICAgICAgIGluY2x1ZGVBc3NldHM6IFtcclxuICAgICAgICAgICAgICAgIFwiZmF2aWNvbi5pY29cIixcclxuICAgICAgICAgICAgICAgIFwicm9ib3RzLnR4dFwiLFxyXG4gICAgICAgICAgICAgICAgXCJpY29ucy9pY29uLTE5MngxOTIucG5nXCIsXHJcbiAgICAgICAgICAgICAgICBcImljb25zL2ljb24tNTEyeDUxMi5wbmdcIixcclxuICAgICAgICAgICAgICAgIFwiaWNvbnMvaWNvbi1tYXNrYWJsZS0xOTJ4MTkyLnBuZ1wiLFxyXG4gICAgICAgICAgICAgICAgXCJpY29ucy9pY29uLW1hc2thYmxlLTUxMng1MTIucG5nXCIsXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcIlBvcCBDbG96ZXQgLSBSZW50IHRoZSBUcmVuZFwiLFxyXG4gICAgICAgICAgICAgICAgc2hvcnRfbmFtZTogXCJQb3AgQ2xvemV0XCIsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJSZW50IGRlc2lnbmVyIGZhc2hpb24gZm9yIGV2ZXJ5IG9jY2FzaW9uLiBEZWxpdmVyZWQgaW4gNjAgbWludXRlcy5cIixcclxuICAgICAgICAgICAgICAgIHN0YXJ0X3VybDogXCIvXCIsXHJcbiAgICAgICAgICAgICAgICBzY29wZTogXCIvXCIsXHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcclxuICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBcInBvcnRyYWl0LXByaW1hcnlcIixcclxuICAgICAgICAgICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiI0Y2RjBFMFwiLFxyXG4gICAgICAgICAgICAgICAgdGhlbWVfY29sb3I6IFwiI0Y2RjBFMFwiLFxyXG4gICAgICAgICAgICAgICAgY2F0ZWdvcmllczogW1wic2hvcHBpbmdcIiwgXCJsaWZlc3R5bGVcIiwgXCJmYXNoaW9uXCJdLFxyXG4gICAgICAgICAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyYzogXCIvaWNvbnMvaWNvbi0xOTJ4MTkyLnBuZ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplczogXCIxOTJ4MTkyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiaW1hZ2UvcG5nXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHB1cnBvc2U6IFwiYW55XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyYzogXCIvaWNvbnMvaWNvbi01MTJ4NTEyLnBuZ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplczogXCI1MTJ4NTEyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiaW1hZ2UvcG5nXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHB1cnBvc2U6IFwiYW55XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyYzogXCIvaWNvbnMvaWNvbi1tYXNrYWJsZS0xOTJ4MTkyLnBuZ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplczogXCIxOTJ4MTkyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiaW1hZ2UvcG5nXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHB1cnBvc2U6IFwibWFza2FibGVcIixcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3JjOiBcIi9pY29ucy9pY29uLW1hc2thYmxlLTUxMng1MTIucG5nXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemVzOiBcIjUxMng1MTJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJpbWFnZS9wbmdcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHVycG9zZTogXCJtYXNrYWJsZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgICAgICAgICBjbGVhbnVwT3V0ZGF0ZWRDYWNoZXM6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBza2lwV2FpdGluZzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGNsaWVudHNDbGFpbTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGdsb2JQYXR0ZXJuczogW1wiKiovKi57aHRtbCxpY28sc3ZnLHdvZmYsd29mZjJ9XCJdLFxyXG4gICAgICAgICAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybFBhdHRlcm46IGZ1bmN0aW9uIChfYSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlcXVlc3QgPSBfYS5yZXF1ZXN0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3QuZGVzdGluYXRpb24gPT09IFwiZG9jdW1lbnRcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlcjogXCJOZXR3b3JrRmlyc3RcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVOYW1lOiBcInBhZ2VzLWNhY2hlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybFBhdHRlcm46IGZ1bmN0aW9uIChfYSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlcXVlc3QgPSBfYS5yZXF1ZXN0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3QuZGVzdGluYXRpb24gPT09IFwic3R5bGVcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlcjogXCJTdGFsZVdoaWxlUmV2YWxpZGF0ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWNoZU5hbWU6IFwiY3NzLWNhY2hlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybFBhdHRlcm46IGZ1bmN0aW9uIChfYSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlcXVlc3QgPSBfYS5yZXF1ZXN0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3QuZGVzdGluYXRpb24gPT09IFwic2NyaXB0XCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwiU3RhbGVXaGlsZVJldmFsaWRhdGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVOYW1lOiBcImpzLWNhY2hlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybFBhdHRlcm46IGZ1bmN0aW9uIChfYSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlcXVlc3QgPSBfYS5yZXF1ZXN0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3QuZGVzdGluYXRpb24gPT09IFwiaW1hZ2VcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlcjogXCJDYWNoZUZpcnN0XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogXCJpbWFnZXMtY2FjaGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiA1MDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogMzAgKiAyNCAqIDYwICogNjAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuc3VwYWJhc2VcXC5jb1xcL3Jlc3RcXC92MVxcLy4qL2ksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwiTmV0d29ya0ZpcnN0XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogXCJzdXBhYmFzZS1hcGktY2FjaGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldHdvcmtUaW1lb3V0U2Vjb25kczogMyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7IHN0YXR1c2VzOiBbMjAwXSB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuc3VwYWJhc2VcXC5jb1xcL3N0b3JhZ2VcXC8uKi9pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVOYW1lOiBcInN1cGFiYXNlLXN0b3JhZ2UtY2FjaGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAxMDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogMzAgKiAyNCAqIDYwICogNjAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ29vZ2xlYXBpc1xcLmNvbVxcLy4qL2ksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwiU3RhbGVXaGlsZVJldmFsaWRhdGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVOYW1lOiBcImdvb2dsZS1mb250cy1zdHlsZXNoZWV0c1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ3N0YXRpY1xcLmNvbVxcLy4qL2ksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWNoZU5hbWU6IFwiZ29vZ2xlLWZvbnRzLXdlYmZvbnRzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogMzAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogMzY1ICogMjQgKiA2MCAqIDYwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6IFwiL29mZmxpbmUuaHRtbFwiLFxyXG4gICAgICAgICAgICAgICAgbmF2aWdhdGVGYWxsYmFja0RlbnlsaXN0OiBbL15cXC9hcGkvLCAvXlxcL2FkbWluL10sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGRldk9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSksXHJcbiAgICBdLFxyXG4gICAgLyoqXHJcbiAgICAgKiBcdUQ4M0RcdUREMTEgVEhJUyBJUyBXSEFUIFlPVSBXRVJFIE1JU1NJTkdcclxuICAgICAqIE1vbm9yZXBvIGludGVybmFsIHBhY2thZ2UgcmVzb2x1dGlvblxyXG4gICAgICovXHJcbiAgICByZXNvbHZlOiB7XHJcbiAgICAgICAgYWxpYXM6IHtcclxuICAgICAgICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICAgICAgICAgIFwiQHBvcGNsb3pldC9hcGktY2xpZW50XCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi4vLi4vcGFja2FnZXMvYXBpLWNsaWVudC9zcmNcIiksXHJcbiAgICAgICAgICAgIFwiQHBvcGNsb3pldC9hdXRoXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi4vLi4vcGFja2FnZXMvYXV0aC9zcmNcIiksXHJcbiAgICAgICAgICAgIFwiQHBvcGNsb3pldC9tYXBib3gtY29yZVwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uLy4uL3BhY2thZ2VzL21hcGJveC1jb3JlL3NyY1wiKSxcclxuICAgICAgICB9LFxyXG4gICAgfSxcclxuICAgIG9wdGltaXplRGVwczoge1xyXG4gICAgICAgIC8vIERpc2FibGUgZGVwZW5kZW5jeSBwcmUtYnVuZGxpbmcgdG8gYXZvaWQgZXNidWlsZC9zcGF3bmVkLXByb2Nlc3MgbWVtb3J5IE9PTVxyXG4gICAgICAgIC8vIG9uIGxvdy1tZW1vcnkvZGV2IFdpbmRvd3MgZW52aXJvbm1lbnRzLiBUaGlzIG1ha2VzIGNvbGQtc3RhcnRzIHNsb3dlclxyXG4gICAgICAgIC8vIGJ1dCBwcmV2ZW50cyB0aGUgZXNidWlsZCBHbyBydW50aW1lIGZyb20gYmVpbmcgaW52b2tlZCBkdXJpbmcgZGV2LlxyXG4gICAgICAgIGluY2x1ZGU6IFsncmVhY3QnLCAncmVhY3QvanN4LXJ1bnRpbWUnLCAncmVhY3QtZG9tJywgJ3JlYWN0LWRvbS9jbGllbnQnXSxcclxuICAgICAgICBleGNsdWRlOiBbXHJcbiAgICAgICAgICAgIFwiQHBvcGNsb3pldC9hcGktY2xpZW50XCIsXHJcbiAgICAgICAgICAgIFwiQHBvcGNsb3pldC9hdXRoXCIsXHJcbiAgICAgICAgICAgIFwiQHBvcGNsb3pldC9tYXBib3gtY29yZVwiLFxyXG4gICAgICAgIF0sXHJcbiAgICB9LFxyXG4gICAgYnVpbGQ6IHtcclxuICAgICAgICB0YXJnZXQ6IFwiZXMyMDIwXCIsXHJcbiAgICAgICAgbWluaWZ5OiBcImVzYnVpbGRcIixcclxuICAgICAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmVuZG9yOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0LXJvdXRlci1kb21cIl0sXHJcbiAgICAgICAgICAgICAgICAgICAgYW5pbWF0aW9uczogW1wiZnJhbWVyLW1vdGlvblwiXSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW1VLFNBQVMsb0JBQW9CO0FBQ2hXLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyxlQUFlO0FBSHhCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQ3hCLE1BQU07QUFBQTtBQUFBLEVBRU4sUUFBUSxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLEVBQ3ZDLFFBQVE7QUFBQSxJQUNKLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNWO0FBQUEsRUFDQSxTQUFT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
