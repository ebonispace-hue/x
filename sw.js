// Service worker sederhana: network-first supaya update selalu terbaru,
// cache hanya dipakai kalau sedang offline.
const CACHE = "eboni-panel-v21";
const SHELL = [
  "./",
  "./index.html",
  "./style.css?v=16",
  "./app.js?v=70",
  "./fx.js?v=1",
  "./nav.js?v=1",
  "./loyalty.js?v=4",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function(cache) { return cache.addAll(SHELL); })
      .catch(function() {})
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event) {
  const request = event.request;
  const url = new URL(request.url);

  // Hanya file panel sendiri; Firebase & CDN langsung ke jaringan
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(function(response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(request, copy); });
        }
        return response;
      })
      .catch(function() {
        return caches.match(request).then(function(cached) {
          return cached || caches.match("./index.html");
        });
      })
  );
});
