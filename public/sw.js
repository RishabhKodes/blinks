// Minimal service worker for PWA installability.
// No caching -- Blinks does not need offline support.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass through all requests to the network.
});
