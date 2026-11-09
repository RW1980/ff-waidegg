/* FF Waidegg – ein Service Worker für die ganze Seite (Scope /).
   OneSignal (Push) und unser Passthrough teilen sich diese Datei.
   Passthrough: GET-Anfragen gehen ins Netz, nichts wird gecacht. */
importScripts("/OneSignalSDKWorker.js");

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request));
});
