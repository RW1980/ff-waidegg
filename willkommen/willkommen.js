/* FF Waidegg – einmaliges Begrüßungs-Overlay auf der Startseite (nur mit JavaScript).
   Beim ersten Besuch: Gemeinschaftsfoto, kurzer Text, Hinweis „Seite aufs Handy holen“.
   Danach nie wieder: Merker „ffw-willkommen“ = „gesehen“ im localStorage (kein Cookie, kein Tracking).
   Testen: ?willkommen=1 zeigt das Overlay immer; ?willkommen=neu löscht den Merker.
   Foto-Tausch (So 8.11.): Dateien unter willkommen/gemeinschaftsfoto-2026.{avif,webp,jpg}
   und -800.{avif,webp,jpg} ersetzen; width/height im Skript anpassen, falls das Seitenverhältnis wechselt. */
(function () {
  "use strict";

  var MERKER = "ffw-willkommen";
  /* feste Maße des Platzhalters / künftigen Gemeinschaftsfotos (CLS am img) */
  var FOTO_W = 1600;
  var FOTO_H = 936;

  var skript = document.currentScript;
  if (!skript || !window.URL || !document.querySelector) return;
  var ordner = new URL("./", skript.src);

  var param = null;
  try { param = new URLSearchParams(location.search).get("willkommen"); } catch (e) { /* alter Browser */ }
  var speicher = null;
  try { speicher = window.localStorage; speicher.getItem(MERKER); } catch (e) { speicher = null; }

  if (param === "neu" && speicher) { try { speicher.removeItem(MERKER); } catch (e) {} }
  var test = param === "1";
  if (!test) {
    if (!speicher || speicher.getItem(MERKER)) return;
  }

  function merken() {
    if (speicher) { try { speicher.setItem(MERKER, "gesehen"); } catch (e) {} }
  }

  var ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var vorherFokus = null;
  var overlay = null;
  var dialog = null;

  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text != null) e.textContent = text;
    return e;
  }

  function start() {
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = new URL("willkommen.css", ordner).href;
    css.onload = aufbauen;
    css.onerror = function () { /* ohne Stil nichts zeigen */ };
    document.head.appendChild(css);
  }

  function aufbauen() {
    vorherFokus = document.activeElement;

    overlay = el("div", "wl");
    overlay.setAttribute("role", "presentation");

    dialog = el("div", "wl-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "wl-titel");
    dialog.setAttribute("aria-describedby", "wl-text");
    dialog.tabIndex = -1;

    var zuX = el("button", "wl-x", "Schließen");
    zuX.type = "button";
    zuX.setAttribute("aria-label", "Begrüßung schließen");

    var foto = el("figure", "wl-foto");
    var pic = document.createElement("picture");
    function source(type, name) {
      var s = document.createElement("source");
      s.type = type;
      s.srcset = new URL(name + "-800." + (type.indexOf("avif") >= 0 ? "avif" : "webp"), ordner).href + " 800w, " +
        new URL(name + "." + (type.indexOf("avif") >= 0 ? "avif" : "webp"), ordner).href + " 1600w";
      s.sizes = "(min-width: 700px) 42rem, 100vw";
      return s;
    }
    pic.appendChild(source("image/avif", "gemeinschaftsfoto-2026"));
    pic.appendChild(source("image/webp", "gemeinschaftsfoto-2026"));
    var img = el("img");
    img.src = new URL("gemeinschaftsfoto-2026.jpg", ordner).href;
    img.alt = "Gemeinschaftsfoto der Freiwilligen Feuerwehr Waidegg (Platzhalter bis 8. November 2026)";
    img.width = FOTO_W;
    img.height = FOTO_H;
    img.decoding = "async";
    img.fetchPriority = "high";
    pic.appendChild(img);
    foto.appendChild(pic);

    var blatt = el("div", "wl-blatt");
    var kicker = el("p", "wl-kicker", "Willkommen");
    kicker.id = "wl-titel";
    var text = el("p", "wl-text");
    text.id = "wl-text";
    text.appendChild(document.createTextNode("Willkommen auf der neuen Website der Freiwilligen Feuerwehr Waidegg. "));
    var leit = el("strong", null, "Eine Kameradschaft. Ein Auftrag. Eine Feuerwehr.");
    text.appendChild(leit);
    text.appendChild(document.createTextNode(" – Hier findest du Termine, Berichte und alles rund um unsere Wehr. Statt feuerwehrwaidegg.at heißt die Adresse jetzt ff-waidegg.at."));

    var handy = el("div", "wl-handy");
    handy.setAttribute("aria-label", "Seite aufs Handy holen");
    var handyTitel = el("h3", null, "Seite aufs Handy holen");
    var tippI = el("p");
    tippI.appendChild(el("span", "wl-plattform", "iPhone / iPad"));
    tippI.appendChild(document.createTextNode("Teilen → Zum Home-Bildschirm"));
    var tippA = el("p");
    tippA.appendChild(el("span", "wl-plattform", "Android"));
    tippA.appendChild(document.createTextNode("Menü → App installieren / Zum Startbildschirm"));
    handy.appendChild(handyTitel);
    handy.appendChild(tippI);
    handy.appendChild(tippA);

    var aktionen = el("div", "wl-aktionen");
    var zu = el("button", "wl-zu", "Zur Website");
    zu.type = "button";
    aktionen.appendChild(zu);

    blatt.appendChild(kicker);
    blatt.appendChild(text);
    blatt.appendChild(handy);
    blatt.appendChild(aktionen);

    dialog.appendChild(zuX);
    dialog.appendChild(foto);
    dialog.appendChild(blatt);
    overlay.appendChild(dialog);

    var skip = document.querySelector(".skip");
    if (skip && skip.parentNode === document.body) skip.insertAdjacentElement("afterend", overlay);
    else document.body.insertBefore(overlay, document.body.firstChild);

    document.documentElement.classList.add("wl-offen");
    merken();

    zuX.addEventListener("click", schliessen);
    zu.addEventListener("click", schliessen);
    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) schliessen();
    });
    document.addEventListener("keydown", taste, true);

    /* Fokus in den Dialog; Schließen-Knopf zuerst */
    zuX.focus();
  }

  function fokusierbar(wurzel) {
    return Array.prototype.slice.call(wurzel.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (n) {
      if (n.hasAttribute("disabled") || n.getAttribute("aria-hidden") === "true") return false;
      var r = n.getClientRects();
      return !!(r && r.length);
    });
  }

  function taste(ev) {
    if (!overlay || overlay.hidden) return;
    if (ev.key === "Escape" || ev.key === "Esc") {
      ev.preventDefault();
      schliessen();
      return;
    }
    if (ev.key !== "Tab") return;
    var nodes = fokusierbar(dialog);
    if (!nodes.length) { ev.preventDefault(); dialog.focus(); return; }
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  function schliessen() {
    merken();
    document.removeEventListener("keydown", taste, true);
    if (overlay) overlay.remove();
    overlay = null;
    dialog = null;
    document.documentElement.classList.remove("wl-offen");
    var ziel = vorherFokus && document.contains(vorherFokus) &&
      vorherFokus !== document.body && vorherFokus !== document.documentElement
      ? vorherFokus
      : document.querySelector(".brand");
    if (ziel) {
      try {
        if (!ziel.hasAttribute("tabindex") && ziel.tabIndex < 0) ziel.setAttribute("tabindex", "-1");
        ziel.focus();
      } catch (e) { /* nicht fokussierbar */ }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
