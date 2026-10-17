// Fahrzeug-Rundgang: Hotspots aus den Listen (data-x/data-y) erzeugen, Bilder einzeln mit Weiter/Zurück.
(function () {
  "use strict";
  var main = document.querySelector(".rundgang");
  if (!main) return;
  var bilder = Array.prototype.slice.call(main.querySelectorAll(".rg-bild"));
  var offen = null; // aktuell geoeffneter Hotspot-Button

  function schliessen(fokus) {
    if (!offen) return;
    var btn = offen;
    offen = null;
    btn.setAttribute("aria-expanded", "false");
    document.getElementById(btn.getAttribute("aria-controls")).hidden = true;
    if (fokus) btn.focus();
  }

  function oeffnen(btn, li, info) {
    var war = offen === btn;
    schliessen(false);
    if (war) return;
    info.querySelector("h3").textContent = li.querySelector("strong").textContent;
    info.querySelector("p").textContent = li.textContent.replace(/^[^–]*–\s*/, "");
    info.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    offen = btn;
    if (info.scrollIntoView) info.scrollIntoView({ block: "nearest" });
  }

  bilder.forEach(function (bild) {
    var foto = bild.querySelector(".rg-foto");
    var info = document.createElement("div");
    info.className = "rg-info";
    info.id = "info-" + bild.id;
    info.hidden = true;
    info.setAttribute("role", "region");
    info.setAttribute("aria-live", "polite");
    info.innerHTML = '<h3></h3><p></p><button type="button" class="rg-zu">Schließen</button>';
    info.querySelector(".rg-zu").addEventListener("click", function () { schliessen(true); });
    foto.insertAdjacentElement("afterend", info);
    bild.querySelectorAll(".rg-punkte li").forEach(function (li, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rg-spot" + (li.classList.contains("rg-offen") ? " rg-offen" : "");
      btn.style.left = li.getAttribute("data-x") + "%";
      btn.style.top = li.getAttribute("data-y") + "%";
      btn.textContent = String(i + 1);
      btn.setAttribute("aria-label", "Punkt " + (i + 1) + ": " + li.querySelector("strong").textContent);
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", info.id);
      btn.addEventListener("click", function () { oeffnen(btn, li, info); });
      foto.appendChild(btn);
    });
  });

  // Navigation Weiter/Zurueck
  var nav = document.createElement("nav");
  nav.className = "rg-nav";
  nav.setAttribute("aria-label", "Rundgang");
  nav.innerHTML = '<button type="button" class="rg-zurueck">← Zurück</button>' +
    '<span class="rg-stand" aria-live="polite"></span>' +
    '<button type="button" class="rg-weiter">Weiter →</button>';
  bilder[bilder.length - 1].insertAdjacentElement("afterend", nav);
  var zurueck = nav.querySelector(".rg-zurueck");
  var weiter = nav.querySelector(".rg-weiter");
  var stand = nav.querySelector(".rg-stand");
  var aktuell = 0;

  function zeige(n, fokus) {
    schliessen(false);
    aktuell = Math.max(0, Math.min(bilder.length - 1, n));
    bilder.forEach(function (b, i) { b.classList.toggle("aktiv", i === aktuell); });
    zurueck.disabled = aktuell === 0;
    weiter.disabled = aktuell === bilder.length - 1;
    stand.textContent = "Bild " + (aktuell + 1) + " von " + bilder.length;
    if (fokus) {
      var h = bilder[aktuell].querySelector("h2");
      h.focus({ preventScroll: true });
      bilder[aktuell].scrollIntoView({ block: "start" });
      if (history.replaceState) history.replaceState(null, "", "#" + bilder[aktuell].id);
    }
  }
  zurueck.addEventListener("click", function () { zeige(aktuell - 1, true); });
  weiter.addEventListener("click", function () { zeige(aktuell + 1, true); });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && offen) schliessen(true);
  });
  document.addEventListener("click", function (ev) {
    if (offen && !ev.target.closest(".rg-spot, .rg-info")) schliessen(false);
  });

  var start = 0;
  bilder.forEach(function (b, i) { if (location.hash === "#" + b.id) start = i; });
  main.classList.add("rg-an");
  zeige(start, false);
})();
