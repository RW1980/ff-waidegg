/* FF Waidegg – Wetterkarte (Windy-Einbettung) auf der Startseite.
   Datenschutzfreundlich: Der iframe von embed.windy.com entsteht erst nach Klick auf „Wetterkarte laden“.
   Kein Cookie, kein Speicher im Browser, keine weiteren Ressourcen. Adresse steht in data-wetter-src (index.html). */
(function () {
  "use strict";
  function init(rahmen) {
    var btn = rahmen.querySelector("[data-wetter-laden]");
    var src = rahmen.getAttribute("data-wetter-src");
    if (!btn || !src) return;
    btn.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = src;
      f.title = "Windy-Wetterkarte mit Vorhersage für Waidegg";
      f.loading = "lazy";
      f.referrerPolicy = "strict-origin-when-cross-origin";
      f.setAttribute("allow", "fullscreen");
      rahmen.textContent = "";
      rahmen.appendChild(f);
      rahmen.classList.add("is-geladen");
      f.setAttribute("tabindex", "0");
      f.focus({ preventScroll: true });
    });
  }
  function start() { Array.prototype.forEach.call(document.querySelectorAll("[data-wetter]"), init); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
