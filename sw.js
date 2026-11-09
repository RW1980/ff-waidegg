/* FF Waidegg – Service Worker der installierbaren App.
   Passthrough: Anfragen gehen ins Netz, nichts wird gecacht, damit neue Berichte
   sofort sichtbar sind. Pagefind und Bilder werden nicht gesondert behandelt.
   Für spätere Push-Nachrichten hier einen Listener "push" ergänzen. */
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
