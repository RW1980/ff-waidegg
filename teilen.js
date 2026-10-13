/* Teilen-Leiste fuer Berichte. Nutzt die kanonische URL (link rel=canonical bzw. og:url),
   damit immer die oeffentliche Adresse geteilt wird. Keine externen Bibliotheken, kein Tracking.
   Markup: <div class="teilen" data-teilen> ... [data-teilen-aktion=nativ|whatsapp|facebook|kopieren] */
(function () {
  "use strict";
  var leisten = document.querySelectorAll("[data-teilen]");
  if (!leisten.length) return;
  function meta(sel, attr) { var e = document.querySelector(sel); return e ? e.getAttribute(attr) : ""; }
  var url = meta('link[rel="canonical"]', "href") || meta('meta[property="og:url"]', "content") || location.href;
  var titel = meta('meta[property="og:title"]', "content") || document.title;
  var text = titel + " – FF Waidegg";
  function kopieren(wert) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(wert);
    return new Promise(function (ok, fehler) {
      var feld = document.createElement("textarea");
      feld.value = wert; feld.setAttribute("readonly", "");
      feld.style.position = "fixed"; feld.style.opacity = "0";
      document.body.appendChild(feld); feld.select();
      try { document.execCommand("copy") ? ok() : fehler(); } catch (e) { fehler(e); }
      document.body.removeChild(feld);
    });
  }
  Array.prototype.forEach.call(leisten, function (leiste) {
    var status = leiste.querySelector("[data-teilen-status]");
    function melden(t) {
      if (!status) return;
      status.textContent = t;
      clearTimeout(melden.t);
      melden.t = setTimeout(function () { status.textContent = ""; }, 2500);
    }
    Array.prototype.forEach.call(leiste.querySelectorAll("[data-teilen-aktion]"), function (el) {
      var aktion = el.getAttribute("data-teilen-aktion");
      if (aktion === "whatsapp") el.href = "https://wa.me/?text=" + encodeURIComponent(text + " " + url);
      if (aktion === "facebook") el.href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url);
      if (aktion === "nativ") {
        if (!navigator.share) return;
        el.hidden = false;
        el.addEventListener("click", function () {
          navigator.share({ title: titel, text: text, url: url }).catch(function () {});
        });
      }
      if (aktion === "kopieren") {
        el.hidden = false;
        el.addEventListener("click", function () {
          kopieren(url).then(function () { melden("Kopiert"); }, function () { melden("Kopieren nicht möglich: " + url); });
        });
      }
    });
  });
})();
