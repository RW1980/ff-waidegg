/* FF Waidegg – ein Service Worker (Scope /), Dateiname bleibt /sw.js.
   Das OneSignal-Skript wird genau einmal geladen.
   Kein eigener fetch-Handler: Chrome verlangt ihn für die Installierbarkeit
   nicht mehr, und ein respondWith auf jede Anfrage kann auf WebKit
   die Verbindung zum Worker blockieren. */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
