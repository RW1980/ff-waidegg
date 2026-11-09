/* Registriert den Service Worker (Vollbild-App, später erweiterbar um Push). */
(function () {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.register("/sw.js").catch(function () {});
})();
