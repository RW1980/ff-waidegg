/* FF Waidegg – Begrüßungs-Maskottchen mit kurzer Tour (nur Startseite, nur mit JavaScript).
   Beim ersten Besuch erscheint unten rechts eine kleine Figur mit Sprechblase und zeigt in 4 Schritten
   Termine, Berichte, Notfall-Infos und Kontakt. Danach nie wieder: Merker „ffw-maskottchen“ im localStorage,
   keine Cookies, kein Tracking, keine externen Dienste.
   Testen: ?maskottchen=a bzw. ?maskottchen=b zeigt die Variante immer (auch wenn schon gesehen),
   ?maskottchen=aus blendet sie aus, ?maskottchen=neu löscht den Merker (dann gilt wieder die Einstellung unten). */
(function () {
  "use strict";

  /* EINSTELLUNG: "aus" (Standard, bis Roland wählt), "a" (Bub, dunkle Einsatzjacke) oder "b" (Mädchen, rote Jacke) */
  var MASKOTTCHEN = "aus";

  var MERKER = "ffw-maskottchen";
  var skript = document.currentScript;
  if (!skript || !window.URL || !document.querySelector) return;
  var ordner = new URL("./", skript.src);   /* …/maskottchen/ – passt in Vorschau und live */
  var wurzel = new URL("../", ordner);

  var param = null;
  try { param = new URLSearchParams(location.search).get("maskottchen"); } catch (e) { /* alter Browser */ }
  var speicher = null;
  try { speicher = window.localStorage; speicher.getItem(MERKER); } catch (e) { speicher = null; }

  if (param === "neu" && speicher) { try { speicher.removeItem(MERKER); } catch (e) {} }
  var test = param === "a" || param === "b";
  var variante = test ? param : MASKOTTCHEN;
  if (param === "aus" || (variante !== "a" && variante !== "b")) return;
  if (!test) {
    /* ohne funktionierenden Speicher nicht zeigen, sonst käme die Tour bei jedem Besuch */
    if (!speicher || speicher.getItem(MERKER)) return;
  }
  function merken() { if (speicher) { try { speicher.setItem(MERKER, "gesehen"); } catch (e) {} } }

  var ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function url(pfad) { return new URL(pfad, wurzel).href; }
  function sichtbar(el) { return !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden"); }

  /* Texte nur aus vorhandenem Seiteninhalt */
  var schritte = [
    { titel: "Termine", pose: "winken",
      text: "Auf dem Kalenderblatt steht der nächste Termin. Antippen zeigt alle anstehenden, jeweils mit Kalenderdatei (.ics).",
      ziel: function () { var t = document.querySelector(".termin:not([hidden])"); if (!t) return null;
        var b = t.querySelector(".tl-blatt"); return sichtbar(b) ? b : (sichtbar(t) ? t : null); } },
    { titel: "Neueste Berichte", pose: "zeigen",
      text: "Hier stehen die neuesten Berichte der FF Waidegg. Unter Aktuelles findest du alle Jahre, die Suche durchsucht alle Berichte.",
      link: ["aktuelles/", "Alle Berichte"],
      ziel: function () { return document.querySelector("main .cards") || document.querySelector("main .section-head"); } },
    { titel: "Im Notfall", pose: "zeigen",
      text: "Feuer, Unfall, Menschen in Not: 122 anrufen. Oben steht der Knopf zum Anrufen, unter Notfall alle Notrufnummern.",
      link: ["notfall/", "Notfall-Infos"],
      ziel: function () { var n = document.querySelector(".site-head .notruf"); return sichtbar(n) ? n : null; } },
    { titel: "Kontakt", pose: "daumen",
      text: "Schreib uns an feuerwehrwaidegg@gmail.com. Facebook, Instagram und YouTube findest du ganz unten.",
      mail: "feuerwehrwaidegg@gmail.com",
      ziel: function () { return document.querySelector(".site-foot"); } }
  ];

  function start() {
    schritte = schritte.filter(function (s) { return s.ziel(); });
    if (!schritte.length) return;
    var css = document.createElement("link");
    css.rel = "stylesheet"; css.href = new URL("maskottchen.css", ordner).href;
    css.onload = aufbauen;
    css.onerror = function () { /* ohne Stil lieber nichts zeigen */ };
    document.head.appendChild(css);
  }

  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text) e.textContent = text;
    return e;
  }

  function aufbauen() {
    merken();
    var nr = 0, ziel = null;
    var box = el("section", "mk mk--" + variante);
    box.setAttribute("aria-label", "Kurze Tour durch die Startseite");
    box.setAttribute("role", "region");

    var blase = el("div", "mk-blase");
    var zu = el("button", "mk-weg", "Überspringen");
    zu.type = "button";
    zu.setAttribute("aria-label", "Tour überspringen und nicht mehr anzeigen");
    var gruss = el("p", "mk-gruss", "Willkommen bei der FF Waidegg!");
    var live = el("div", "mk-text");
    live.setAttribute("aria-live", "polite");
    var stand = el("p", "mk-stand");
    var titel = el("p", "mk-titel");
    var text = el("p", "mk-inhalt");
    var mehr = el("a", "mk-link");
    live.appendChild(stand); live.appendChild(titel); live.appendChild(text);
    var knoepfe = el("div", "mk-knoepfe");
    var zurueck = el("button", "mk-zurueck", "Zurück");
    var weiter = el("button", "mk-weiter", "Weiter");
    zurueck.type = weiter.type = "button";
    knoepfe.appendChild(zurueck); knoepfe.appendChild(weiter);
    blase.appendChild(zu); blase.appendChild(gruss); blase.appendChild(live); blase.appendChild(mehr); blase.appendChild(knoepfe);

    var figur = el("picture", "mk-figur");
    var quelle = el("source");
    quelle.type = "image/webp";
    var bild = el("img");
    bild.alt = ""; bild.width = 140; bild.height = 240; bild.decoding = "async";
    figur.appendChild(quelle); figur.appendChild(bild);
    figur.setAttribute("aria-hidden", "true");

    box.appendChild(blase); box.appendChild(figur);
    var skip = document.querySelector(".skip");
    if (skip && skip.parentNode === document.body) skip.insertAdjacentElement("afterend", box);
    else document.body.insertBefore(box, document.body.firstChild);
    document.documentElement.classList.add("mk-offen");

    /* alle Posen vorladen, damit der Wechsel nicht flackert */
    ["winken", "zeigen", "daumen"].forEach(function (p) { var i = new Image(); i.src = new URL(variante + "-" + p + ".webp", ordner).href; });

    function platz() { document.documentElement.style.setProperty("--mk-hoehe", box.offsetHeight + "px"); }

    function hinscrollen(z) {
      if (!z || getComputedStyle(z).position === "fixed") return;
      var kopf = document.querySelector(".site-head");
      var oben = 8, unten = box.getBoundingClientRect().top - 12;
      if (kopf && getComputedStyle(kopf).position === "sticky") oben = Math.max(oben, kopf.getBoundingClientRect().bottom + 8);
      var r = z.getBoundingClientRect(), d = 0;
      if (r.top >= oben && r.bottom <= unten) return;
      if (r.height > unten - oben || r.top < oben) d = r.top - oben; else d = r.bottom - unten;
      window.scrollBy({ top: d, behavior: ruhig ? "auto" : "smooth" });
    }

    function zeigen(i) {
      nr = i;
      var s = schritte[nr];
      if (ziel) ziel.classList.remove("mk-ziel");
      ziel = s.ziel();
      if (ziel) ziel.classList.add("mk-ziel");
      gruss.hidden = nr !== 0;
      stand.textContent = "Schritt " + (nr + 1) + " von " + schritte.length;
      titel.textContent = s.titel;
      text.textContent = s.text;
      if (s.link) { mehr.hidden = false; mehr.href = url(s.link[0]); mehr.textContent = s.link[1]; }
      else if (s.mail) { mehr.hidden = false; mehr.href = "mailto:" + s.mail; mehr.textContent = "E-Mail schreiben"; }
      else mehr.hidden = true;
      zurueck.hidden = nr === 0;
      var letzter = nr === schritte.length - 1;
      weiter.textContent = letzter ? "Fertig" : "Weiter";
      weiter.setAttribute("aria-label", letzter ? "Tour beenden" : "Weiter zu Schritt " + (nr + 2));
      quelle.srcset = new URL(variante + "-" + s.pose + ".webp", ordner).href;
      bild.src = new URL(variante + "-" + s.pose + ".png", ordner).href;
      figur.className = "mk-figur mk-pose-" + s.pose;
      platz();
      hinscrollen(ziel);
    }

    function schliessen() {
      merken();
      var fokusDrin = box.contains(document.activeElement);
      if (ziel) ziel.classList.remove("mk-ziel");
      box.remove();
      document.documentElement.classList.remove("mk-offen");
      document.documentElement.style.removeProperty("--mk-hoehe");
      window.removeEventListener("keydown", taste, true);
      window.removeEventListener("resize", platz);
      if (fokusDrin) { var b = document.querySelector(".brand") || document.body; b.focus(); }
    }

    function taste(ev) {
      if (ev.key !== "Escape" && ev.key !== "Esc") return;
      /* offenes Menü, Untermenü, Terminblatt oder Bildansicht zuerst schließen lassen */
      if (document.querySelector("#hauptmenue.open, .nav-sub-toggle[aria-expanded='true'], .termin.is-offen, .lightbox:not([hidden])")) return;
      schliessen();
    }

    zu.addEventListener("click", schliessen);
    zurueck.addEventListener("click", function () { zeigen(nr - 1); if (nr === 0) weiter.focus(); });
    weiter.addEventListener("click", function () {
      if (nr >= schritte.length - 1) schliessen();
      else { zeigen(nr + 1); if (nr === schritte.length - 1) weiter.focus(); }
    });
    window.addEventListener("keydown", taste, true);
    window.addEventListener("resize", platz);
    zeigen(0);
  }

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();
