// Service worker: makes the app installable and keeps the last-loaded screen
// available if the network drops. Chat/AI features still need a live connection.
//
// Pages are fetched network-first, so a new deploy shows up right away instead
// of an old cached copy pointing at JS files that no longer exist.

const CACHE_NAME = "throttle-tech-shell-v4";
const SHELL_FILES = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/logo-wordmark.webp", "/logo-wordmark-sm.webp"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Never cache API calls — those must always hit the live server.
  if (req.url.includes("/api/")) return;

  // Page loads: network first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Static files (hashed JS/CSS, icons): cache first, then remember them.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
    )
  );
});
