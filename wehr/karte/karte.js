/* Ortskarte "Einsätze & Geschichte" (/wehr/karte/).
   Zeitregler und Filter wirken auf die Liste; die Karte (Leaflet, von diesem Server)
   und die Kartenbilder von tile.openstreetmap.org werden erst nach Klick auf "Karte laden" geholt.
   Wer "Karte künftig automatisch laden" wählt, bekommt im localStorage den Merker
   "ffw-karte-laden" = "1" (kein Cookie, wird nie übertragen); dann lädt die Karte beim Öffnen. */
(function () {
  "use strict";
  var main = document.querySelector(".ka");
  if (!main) return;
  var basis = main.getAttribute("data-basis") || "/";
  var ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ARTEN = { einsatz: "Einsatz", bewerb: "Bewerb", fest: "Fest", geschichte: "Geschichte", uebung: "Übung" };
  var FARBE = { einsatz: "#a4161a", bewerb: "#8c7344", fest: "#2d5b86", geschichte: "#242220", uebung: "#3d6b35" };
  var MON = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

  var punkte = Array.prototype.slice.call(main.querySelectorAll(".ka-punkt"));
  var jahrBloecke = Array.prototype.slice.call(main.querySelectorAll(".ka-jahr"));
  var steuerung = main.querySelector(".ka-steuerung");
  var reglerBox = main.querySelector(".ka-regler");
  var regler = main.querySelector("#ka-regler");
  var wert = main.querySelector(".ka-wert");
  var reglerTitel = main.querySelector(".ka-regler-titel");
  var status = main.querySelector(".ka-status");
  var leer = main.querySelector(".ka-leer");
  var schritte = main.querySelectorAll(".ka-schritt");

  var jahre = [];
  punkte.forEach(function (li) { var j = +li.getAttribute("data-jahr"); if (jahre.indexOf(j) < 0) jahre.push(j); });
  jahre.sort(function (a, b) { return a - b; });
  var jahrzehnte = [];
  jahre.forEach(function (j) { var d = Math.floor(j / 10) * 10; if (jahrzehnte.indexOf(d) < 0) jahrzehnte.push(d); });

  var modus = "alle", stufen = [], arten = { einsatz: 1, bewerb: 1, fest: 1, geschichte: 1, uebung: 1 };

  function zeitPasst(j) {
    if (modus === "alle") return true;
    var s = stufen[+regler.value];
    return modus === "jahr" ? j === s : Math.floor(j / 10) * 10 === s;
  }
  function zeitText() {
    if (modus === "alle") return "Alle Jahre";
    var s = stufen[+regler.value];
    return modus === "jahr" ? String(s) : s + "er-Jahre";
  }

  function anwenden() {
    var n = 0;
    punkte.forEach(function (li) {
      var sicht = !!arten[li.getAttribute("data-art")] && zeitPasst(+li.getAttribute("data-jahr"));
      li.hidden = !sicht;
      if (sicht) n++;
    });
    jahrBloecke.forEach(function (b) { b.hidden = !b.querySelector(".ka-punkt:not([hidden])"); });
    leer.hidden = n > 0;
    if (modus !== "alle") {
      var s = stufen[+regler.value];
      wert.textContent = modus === "jahr" ? s : s + "er";
      regler.setAttribute("aria-valuetext", zeitText());
      schritte[0].disabled = +regler.value <= 0;
      schritte[1].disabled = +regler.value >= stufen.length - 1;
    }
    status.textContent = zeitText() + ": " + (n === 1 ? "1 Punkt" : n + " Punkte") + (karte ? " auf Karte und Liste" : " in der Liste");
    if (karte) markerZeichnen();
  }

  function modusSetzen(m) {
    var alt = modus === "alle" ? null : stufen[+regler.value];
    modus = m;
    reglerBox.hidden = m === "alle";
    if (m === "alle") { anwenden(); return; }
    stufen = m === "jahr" ? jahre : jahrzehnte;
    reglerTitel.textContent = m === "jahr" ? "Jahr" : "Jahrzehnt";
    regler.max = String(stufen.length - 1);
    var ziel = stufen.length - 1;
    if (alt !== null) {
      for (var i = 0; i < stufen.length; i++) {
        if (m === "jahr" ? Math.floor(stufen[i] / 10) * 10 === alt || stufen[i] === alt : stufen[i] === Math.floor(alt / 10) * 10) { ziel = i; break; }
      }
    }
    regler.value = String(ziel);
    anwenden();
  }

  steuerung.hidden = false;
  main.querySelectorAll('input[name="ka-modus"]').forEach(function (r) {
    r.addEventListener("change", function () { if (r.checked) modusSetzen(r.value); });
  });
  regler.addEventListener("input", anwenden);
  Array.prototype.forEach.call(schritte, function (b) {
    b.addEventListener("click", function () {
      regler.value = String(Math.min(stufen.length - 1, Math.max(0, +regler.value + +b.getAttribute("data-schritt"))));
      anwenden();
    });
  });
  main.querySelectorAll(".ka-arten input").forEach(function (c) {
    c.addEventListener("change", function () { arten[c.value] = c.checked ? 1 : 0; anwenden(); });
  });

  /* ---------- Karte (erst nach Klick) ---------- */
  var kartenBox = main.querySelector(".ka-karte");
  var ladenKnopf = main.querySelector(".ka-laden");
  var zeile = main.querySelector(".ka-kartenzeile");
  var karte = null, ebene = null, daten = null, marker = {};
  kartenBox.hidden = false;

  function laden(url, css) {
    return new Promise(function (ok, fehler) {
      var el = document.createElement(css ? "link" : "script");
      if (css) { el.rel = "stylesheet"; el.href = url; } else { el.src = url; }
      el.onload = ok; el.onerror = function () { fehler(new Error(url)); };
      document.head.appendChild(el);
    });
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function datum(d) {
    var t = d.split("-");
    return t.length === 3 ? (+t[2]) + ". " + MON[+t[1] - 1] + " " + t[0] : t.length === 2 ? MON[+t[1] - 1] + " " + t[0] : t[0];
  }

  /* Merker im Browser (localStorage), nur auf Wunsch */
  var MERKER = "ffw-karte-laden";
  var merkenBox = main.querySelector(".ka-merken");
  var merkerKnopf = main.querySelector(".ka-merker");
  var merkerInfo = main.querySelector(".ka-merker-info");
  function gemerkt() { try { return window.localStorage.getItem(MERKER) === "1"; } catch (e) { return false; } }
  function merken(an) {
    try { if (an) window.localStorage.setItem(MERKER, "1"); else window.localStorage.removeItem(MERKER); return true; } catch (e) { return false; }
  }
  function merkerZeigen() {
    var an = gemerkt();
    merkerKnopf.textContent = an ? "Karte nicht mehr automatisch laden" : "Karte künftig automatisch laden";
  }
  merkerKnopf.addEventListener("click", function () {
    var an = !gemerkt();
    if (!merken(an)) { merkerInfo.textContent = "Dein Browser erlaubt das Merken nicht."; return; }
    merkerZeigen();
    merkerInfo.textContent = an ? "Gemerkt: Die Karte lädt beim nächsten Besuch automatisch." : "Erledigt: Der Merker ist gelöscht, die Karte lädt erst wieder nach Klick.";
  });

  function kartenLaden() {
    ladenKnopf.disabled = true;
    ladenKnopf.textContent = "Karte wird geladen …";
    Promise.all([
      laden(main.getAttribute("data-leaflet-css"), true),
      laden(main.getAttribute("data-leaflet-js"), false),
      fetch(main.getAttribute("data-json")).then(function (r) { if (!r.ok) throw new Error("json"); return r.json(); })
    ]).then(function (e) { daten = e[2]; kartenStart(); }).catch(function () {
      ladenKnopf.disabled = false;
      ladenKnopf.textContent = "Erneut versuchen";
    });
  }
  ladenKnopf.addEventListener("click", function () {
    var c = merkenBox && merkenBox.querySelector("input");
    if (c && c.checked) merken(true);
    kartenLaden();
  });

  function kartenStart() {
    var L = window.L;
    kartenBox.innerHTML = "";
    karte = L.map(kartenBox, {
      zoomAnimation: !ruhig, fadeAnimation: !ruhig, markerZoomAnimation: !ruhig, inertia: !ruhig,
      scrollWheelZoom: false, minZoom: 7, maxZoom: 16
    });
    karte.attributionControl.setPrefix('<a href="https://leafletjs.com/">Leaflet</a>');
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
    }).addTo(karte);
    karte.fitBounds([[46.585, 12.98], [46.70, 13.50]]);
    karte.on("focus", function () { karte.scrollWheelZoom.enable(); });
    karte.on("blur", function () { karte.scrollWheelZoom.disable(); });
    ebene = L.layerGroup().addTo(karte);
    zeile.hidden = false;
    merkerZeigen();
    main.querySelector(".ka-alle").addEventListener("click", einpassen);
    punkte.forEach(function (li) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ka-zeigen";
      b.textContent = "Auf der Karte";
      b.addEventListener("click", function () { zeigen(li.getAttribute("data-ort")); });
      li.querySelector(".ka-links").appendChild(b);
    });
    anwenden();
  }

  function sichtbareNachOrt() {
    var g = {};
    punkte.forEach(function (li) {
      if (li.hidden) return;
      var o = li.getAttribute("data-ort");
      (g[o] = g[o] || []).push(daten.punkte[+li.getAttribute("data-i")]);
    });
    return g;
  }

  function markerZeichnen() {
    var L = window.L;
    ebene.clearLayers();
    marker = {};
    var g = sichtbareNachOrt();
    Object.keys(g).forEach(function (k) {
      var o = daten.orte[k], liste = g[k], zahl = {}, i;
      liste.forEach(function (p) { zahl[p.art] = (zahl[p.art] || 0) + 1; });
      var keys = Object.keys(zahl), hg;
      if (keys.length === 1) { hg = FARBE[keys[0]]; } else {
        var teile = [], ab = 0;
        for (i = 0; i < keys.length; i++) {
          var bis = ab + zahl[keys[i]] / liste.length * 360;
          teile.push(FARBE[keys[i]] + " " + ab.toFixed(1) + "deg " + bis.toFixed(1) + "deg");
          ab = bis;
        }
        hg = "conic-gradient(" + teile.join(",") + ")";
      }
      var d = Math.round(Math.min(38, 22 + Math.sqrt(liste.length) * 4));
      var beschr = o.name + (o.ungefaehr ? " (ungefähr)" : "") + ": " + liste.length + (liste.length === 1 ? " Punkt" : " Punkte");
      var icon = L.divIcon({
        className: "",
        html: '<span class="ka-marker' + (o.ungefaehr ? " ka-ungefaehr-m" : "") + '" style="width:' + d + "px;height:" + d + "px;background:" + hg + '">' + liste.length + "</span>",
        iconSize: [d, d], iconAnchor: [d / 2, d / 2], popupAnchor: [0, -d / 2]
      });
      var m = L.marker([o.lat, o.lon], { icon: icon, title: beschr, alt: beschr, keyboard: true, riseOnHover: true });
      m.bindPopup(function () { return popup(o, liste); }, { maxWidth: 290, minWidth: 220, autoPanPaddingTopLeft: [50, 20], autoPanPaddingBottomRight: [20, 20] });
      m.addTo(ebene);
      marker[k] = m;
    });
  }

  function popup(o, liste) {
    var h = '<div class="ka-pop"><h3>' + esc(o.name) + "</h3>";
    if (o.ungefaehr) h += '<span class="ka-ungefaehr">ungefähr (' + esc(o.hinweis) + ")</span>";
    h += "<ul>";
    liste.forEach(function (p) {
      h += "<li>";
      if (p.foto) h += '<img src="' + esc(basis + p.foto) + '" alt="" width="72" height="54" loading="lazy" decoding="async">';
      h += '<p><span class="ka-meta">' + esc(ARTEN[p.art]) + " · " + esc(datum(p.datum)) + "</span><br><strong>" + esc(p.titel) + "</strong></p>";
      if (p.text) h += "<p>" + esc(p.text) + "</p>";
      if (p.ergebnisse) h += '<ul class="ka-erg">' + p.ergebnisse.map(function (z) { return "<li>" + esc(z) + "</li>"; }).join("") + "</ul>";
      if (p.beleg) h += '<p class="ka-beleg">' + esc(p.beleg) + "</p>";
      h += '<p><a href="' + esc(basis + p.link) + '">' + (p.link.indexOf("berichte/") === 0 ? "Zum Bericht" : p.link.indexOf("wehr/chronik/") === 0 ? "Zur Chronik" : p.link.indexOf("bewerbe/ergebnisse/") === 0 ? "Zu den Ergebnissen" : "Zur NeverEnding Story") + " →</a></p>";
      h += "</li>";
    });
    return h + "</ul></div>";
  }

  function einpassen() {
    var L = window.L, pts = [];
    Object.keys(marker).forEach(function (k) { pts.push(marker[k].getLatLng()); });
    if (!pts.length) return;
    if (pts.length === 1) { karte.setView(pts[0], 12, { animate: !ruhig }); return; }
    karte.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 13, animate: !ruhig });
  }

  function zeigen(ort) {
    var m = marker[ort];
    if (!m) return;
    kartenBox.scrollIntoView({ behavior: ruhig ? "auto" : "smooth", block: "center" });
    karte.setView(m.getLatLng(), Math.max(karte.getZoom(), 12), { animate: !ruhig });
    m.openPopup();
  }

  anwenden();
  if (gemerkt()) kartenLaden();
})();
