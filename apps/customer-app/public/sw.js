/**
 * Production Service Worker for Popclozet PWA
 *
 * Handles:
 *  - Push notifications (Web Push API)
 *  - Notification click routing (HashRouter-aware)
 *  - Basic runtime caching (fonts, images, assets)
 *  - Offline navigation fallback
 *
 * This file lives in /public and is copied as-is to /dist/sw.js by Vite.
 * No build step or VitePWA plugin required.
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = "popclozet-" + CACHE_VERSION;

// ═══════════════════════════════════════════════════════════════
// INSTALL & ACTIVATE
// ═══════════════════════════════════════════════════════════════

self.addEventListener("install", function (event) {
  console.log("[SW] Installing...");
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  console.log("[SW] Activated");
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) {
            console.log("[SW] Purging old cache:", key);
            return caches.delete(key);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ═══════════════════════════════════════════════════════════════
// FETCH — lightweight runtime caching
// ═══════════════════════════════════════════════════════════════

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);

  // Skip non-GET, extensions, etc.
  if (event.request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;

  // Navigation → network first, fall back to cache or offline page
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match("/offline.html");
        });
      })
    );
    return;
  }

  // Google Fonts → cache first (immutable)
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        return cached || fetch(event.request).then(function (response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Same-origin static assets → stale-while-revalidate
  if (url.origin === self.location.origin) {
    var isStatic = /\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?)$/i.test(url.pathname)
      && !url.pathname.endsWith("/sw.js")
      && !url.pathname.endsWith("/dev-sw.js");

    if (isStatic) {
      event.respondWith(
        caches.match(event.request).then(function (cached) {
          var fetchPromise = fetch(event.request)
            .then(function (response) {
              if (response.ok) {
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                  cache.put(event.request, clone);
                });
              }
              return response;
            })
            .catch(function () { return cached; });

          return cached || fetchPromise;
        })
      );
      return;
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

self.addEventListener("push", function (event) {
  console.log("[SW] Push event received");

  if (!event.data) {
    console.warn("[SW] Push event has no data");
    return;
  }

  var payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "Popclozet", body: event.data.text() };
  }

  var title = payload.title || "Popclozet";
  var options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-192x192.png",
    tag: payload.tag || "general",
    renotify: true,
    requireInteraction: false,
    vibrate: [100, 50, 100, 50, 200],
    data: payload.data || { url: payload.url || "/" },
    actions: [
      { action: "open", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION CLICK — route to correct page (HashRouter)
// ═══════════════════════════════════════════════════════════════

self.addEventListener("notificationclick", function (event) {
  console.log("[SW] Notification clicked:", event.notification.tag);
  event.notification.close();

  if (event.action === "dismiss") return;

  var urlPath = (event.notification.data && event.notification.data.url) || "/";
  var targetUrl = new URL("/#" + urlPath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if ("focus" in client) {
            client.focus();
            client.postMessage({
              type: "NOTIFICATION_CLICK",
              url: urlPath,
              data: event.notification.data,
            });
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

self.addEventListener("notificationclose", function (event) {
  console.log("[SW] Notification dismissed:", event.notification.tag);
});

// ═══════════════════════════════════════════════════════════════
// MESSAGE — handle skip-waiting from UpdatePrompt
// ═══════════════════════════════════════════════════════════════

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
