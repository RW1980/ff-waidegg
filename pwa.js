/* OneSignal (Web SDK v16): ein Service Worker (sw.js), keine Glocke, kein Popup von selbst.
   Der Knopf [data-push] ist sofort klickbar. Safari/WebKit verlangt, dass
   Notification.requestPermission() noch im Klick selbst aufgerufen wird.
   Die Diagnose erscheint mit ?pushdebug=1, nach einem Fehler und wenn der
   Knopf 10 s nach dem Tippen weder aktiv noch eine Fehlermeldung zeigt. */
(function () {
  var APP = "0cff0d8c-39b6-497b-bf07-d6c2e58a03fa";
  var abonniert = false;
  var initFehler = false;
  var wartet = false;
  var erlaubnisLaeuft = false;
  var debug = /(?:^|[?&])pushdebug=1(?:&|$)/.test(location.search);
  var diagnose = {
    geladen: false,
    init: "nein",
    fehler: "",
    optedIn: false,
    id: "",
    pushSupported: "",
    permissionNachPrompt: "",
    schritte: { klick: "", erlaubnis: "", init: "", optInStart: "", optInFertig: "" },
    swFehler: ""
  };
  var initWatch = 0;
  var optWatch = 0;
  var boxTimer = 0;
  var initBekannt = false;
  var hinweisErzwingen = /(?:^|[?&])pushhinweis=1(?:&|$)/.test(location.search);
  var HINWEIS = "ffw-push-hinweis";

  function zeit() {
    var d = new Date();
    function z(n) { return (n < 10 ? "0" : "") + n; }
    return z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds());
  }
  function vapidDa() {
    return typeof PushSubscriptionOptions !== "undefined" &&
      Object.prototype.hasOwnProperty.call(PushSubscriptionOptions.prototype, "applicationServerKey");
  }
  function legacyDa() {
    return typeof window.safari !== "undefined" && window.safari.pushNotification != null;
  }
  /* Der CDN-Stub lädt das SDK nur bei VAPID oder beim alten Safari-Weg.
     Sonst bleibt OneSignalDeferred liegen (weder resolve noch reject). */
  function stubLaesstSdkZu() {
    return vapidDa() || legacyDa();
  }
  /* Legacy-Pfad braucht safari_web_id. Den hat diese App nicht.
     Erwartet wird er nur, wenn window.safari.pushNotification da ist und VAPID fehlt. */
  function legacyErwartet() {
    return legacyDa() && !vapidDa();
  }
  function mitTimeout(promise, name) {
    return new Promise(function (resolve, reject) {
      var fertig = false;
      var timer = setTimeout(function () {
        if (fertig) return;
        fertig = true;
        var fehler = new Error(name + " nach 15 s nicht fertig");
        console.warn(fehler.message);
        reject(fehler);
      }, 15000);
      Promise.resolve(promise).then(function (wert) {
        if (fertig) return;
        fertig = true;
        clearTimeout(timer);
        resolve(wert);
      }, function (fehler) {
        if (fertig) return;
        fertig = true;
        clearTimeout(timer);
        reject(fehler);
      });
    });
  }
  function kuerzen(id) {
    if (!id) return "–";
    return id.length > 10 ? id.slice(0, 8) + "…" : id;
  }
  function abschluss() {
    var knopf = document.querySelector("[data-push-knopf]");
    if (knopf && knopf.getAttribute("data-push-status") === "aktiv") return true;
    if (knopf && knopf.getAttribute("data-push-status") === "blockiert") return true;
    var label = document.querySelector("[data-push-label]");
    var text = label ? label.textContent : "";
    return text.indexOf("Gerade nicht verfügbar") === 0;
  }
  function boxOeffnen(grund) {
    debug = true;
    if (grund && !diagnose.fehler) diagnose.fehler = grund;
    debugZeichnen();
  }
  function boxNachZehn() {
    clearTimeout(boxTimer);
    boxTimer = setTimeout(function () {
      if (abschluss()) return;
      boxOeffnen("Knopf nach 10 s weder aktiv noch Fehlermeldung");
    }, 10000);
  }
  function fehlgeschlagen(fehler, warnung) {
    var text = String(fehler && fehler.message || fehler || warnung || "unbekannt");
    console.warn(warnung || "OneSignal", fehler || text);
    wartet = false;
    initFehler = true;
    initBekannt = true;
    diagnose.fehler = text;
    debug = true;
    setze("Gerade nicht verfügbar, bitte später nochmal");
    debugZeichnen();
    hinweisAktualisieren();
  }
  function initBegrenzen() {
    clearTimeout(initWatch);
    initWatch = setTimeout(function () {
      if (diagnose.init === "fertig" || diagnose.init === "Fehler") return;
      diagnose.init = "Fehler";
      var hinweis = stubLaesstSdkZu() ? "" : " OneSignal-Stub: Incompatible browser (kein VAPID, kein safari.pushNotification).";
      fehlgeschlagen(new Error("OneSignal.init nach 15 s nicht fertig." + hinweis), "OneSignal.init");
    }, 15000);
  }
  function optBegrenzen() {
    clearTimeout(optWatch);
    optWatch = setTimeout(function () {
      if (!wartet || diagnose.schritte.optInFertig) return;
      var hinweis = diagnose.geladen ? "" : " OneSignal-SDK nicht geladen.";
      fehlgeschlagen(new Error("OneSignal optIn nach 15 s nicht fertig." + hinweis), "OneSignal optIn");
    }, 15000);
  }
  function kopieren(text, knopf, box) {
    function ok() { knopf.textContent = "Kopiert"; }
    function fail() {
      knopf.textContent = "Kopieren fehlgeschlagen";
      if (!box) return;
      try {
        var bereich = document.createRange();
        bereich.selectNodeContents(box);
        var auswahl = window.getSelection();
        auswahl.removeAllRanges();
        auswahl.addRange(bereich);
      } catch (fehler) { /* Auswahl ist nur der Notnagel */ }
    }
    function auswahl() {
      var feld = document.createElement("textarea");
      feld.value = text;
      feld.setAttribute("readonly", "");
      feld.style.cssText = "position:fixed;left:-9999px;top:0;";
      document.body.appendChild(feld);
      feld.select();
      var geschafft = false;
      try { geschafft = document.execCommand("copy"); } catch (fehler) { geschafft = false; }
      document.body.removeChild(feld);
      return geschafft;
    }
    var sofort = auswahl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () {
        if (sofort) ok(); else fail();
      });
      return;
    }
    if (sofort) ok(); else fail();
  }
  function debugZeichnen() {
    if (!debug) return;
    var bloecke = knoepfe();
    var regPromise = navigator.serviceWorker ? navigator.serviceWorker.getRegistrations() : Promise.resolve([]);
    regPromise.then(function (regs) {
      regs = regs || [];
      var reg = null;
      regs.forEach(function (eintrag) {
        if (!reg) reg = eintrag;
        if (eintrag.scope && /\/$/.test(eintrag.scope)) reg = eintrag;
      });
      var sw = reg && (reg.active || reg.waiting || reg.installing);
      var urls = [];
      regs.forEach(function (eintrag) {
        var worker = eintrag.active || eintrag.waiting || eintrag.installing;
        if (worker) urls.push(worker.scriptURL);
      });
      var aboPromise = reg && reg.pushManager ? reg.pushManager.getSubscription() : Promise.resolve(null);
      return Promise.resolve(aboPromise).then(function (abo) {
        var skript = !!document.querySelector("script[src*='OneSignalSDK.page.es6.js']");
        var schritte = diagnose.schritte;
        var zeilen = [
          "UA: " + navigator.userAgent,
          "standalone: " + (standalone() ? "ja" : "nein"),
          "Notification.permission: " + (typeof Notification !== "undefined" ? Notification.permission : "fehlt"),
          "Notification.permission nach requestPermission: " + (diagnose.permissionNachPrompt || "–"),
          "PushManager: " + ("PushManager" in window ? "ja" : "nein"),
          "SW: " + (sw ? sw.scriptURL + " " + sw.state : "keine"),
          "SW-Registrierungen: " + regs.length + (urls.length ? " " + urls.join(" | ") : ""),
          "SW-Controller: " + (navigator.serviceWorker && navigator.serviceWorker.controller ? "ja" : "nein"),
          "SW-Fehler: " + (diagnose.swFehler || "–"),
          "pushManager-Abo: " + (abo ? "ja" : "nein"),
          "OneSignal-Skript: " + (skript ? "ja" : "nein"),
          "OneSignal geladen: " + (diagnose.geladen ? "ja" : "nein"),
          "VAPID applicationServerKey: " + (vapidDa() ? "ja" : "nein"),
          "Legacy safari.pushNotification: " + (legacyDa() ? "ja" : "nein"),
          "isPushSupported: " + (diagnose.pushSupported === "" ? "–" : (diagnose.pushSupported ? "ja" : "nein")),
          "init: " + diagnose.init,
          "Klick: " + (schritte.klick || "–"),
          "requestPermission-Ergebnis: " + (schritte.erlaubnis || "–"),
          "init fertig: " + (schritte.init || "–"),
          "optIn gestartet: " + (schritte.optInStart || "–"),
          "optIn fertig: " + (schritte.optInFertig || "–"),
          "Fehler: " + (diagnose.fehler || "–"),
          "optedIn: " + (diagnose.optedIn ? "ja" : "nein"),
          "Abo-ID: " + kuerzen(diagnose.id)
        ].join("\n");
        var ziele = [];
        bloecke.forEach(function (block) {
          if (!block.classList.contains("push--fuss")) ziele.push(block);
        });
        if (!ziele.length && bloecke.length) ziele = [bloecke[0]];
        ziele.forEach(function (block) {
          var box = block.querySelector("[data-push-debug]");
          if (!box) {
            var huelle = document.createElement("div");
            huelle.setAttribute("data-push-debug-huelle", "1");
            box = document.createElement("pre");
            box.setAttribute("data-push-debug", "1");
            box.style.cssText = "margin:.45rem 0 0;padding:.5rem;max-width:100%;overflow:auto;white-space:pre-wrap;word-break:break-word;font:12px/1.45 ui-monospace,monospace;background:#fff;border:1px solid #d4cbbc;color:#1c1b19;";
            var knopf = document.createElement("button");
            knopf.type = "button";
            knopf.setAttribute("data-push-debug-kopie", "1");
            knopf.textContent = "Diagnose kopieren";
            knopf.style.cssText = "margin:.35rem 0 0;padding:.35rem .6rem;font:600 12px/1.2 system-ui,sans-serif;background:#fff;border:1px solid #d4cbbc;color:#1c1b19;";
            knopf.addEventListener("click", function () {
              kopieren(box.textContent, knopf, box);
            });
            huelle.appendChild(box);
            huelle.appendChild(knopf);
            block.appendChild(huelle);
          }
          box.textContent = zeilen;
        });
      });
    }).catch(function (fehler) {
      console.warn("pushdebug", fehler);
      diagnose.fehler = diagnose.fehler || String(fehler && fehler.message || fehler);
    });
  }

  function ios() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function standalone() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }
  function knoepfe() {
    return document.querySelectorAll("[data-push]");
  }
  function setze(text, status) {
    knoepfe().forEach(function (block) {
      var knopf = block.querySelector("[data-push-knopf]");
      var label = block.querySelector("[data-push-label]");
      if (!label) return;
      label.textContent = text;
      if (!knopf) return;
      if (status) knopf.setAttribute("data-push-status", status);
      else knopf.removeAttribute("data-push-status");
      knopf.setAttribute("aria-pressed", status === "aktiv" ? "true" : "false");
      knopf.disabled = status === "blockiert";
    });
  }
  function male() {
    debugZeichnen();
    if (wartet) return;
    hinweisAktualisieren();
    if (ios() && !standalone()) {
      setze("Auf dem iPhone/iPad erst ‚Zum Home-Bildschirm‘ hinzufügen");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied" && !abonniert) {
      setze("Benachrichtigungen im Browser blockiert – in den Einstellungen erlauben", "blockiert");
      return;
    }
    if (initFehler) {
      setze("Gerade nicht verfügbar, bitte später nochmal");
      return;
    }
    if (abonniert) setze("Benachrichtigungen aktiv · Abbestellen", "aktiv");
    else setze("Benachrichtigungen bei neuen Berichten");
  }
  function speicherLesen(schluessel) {
    try { return localStorage.getItem(schluessel); } catch (fehler) { return null; }
  }
  function speicherSchreiben(schluessel, wert) {
    try { localStorage.setItem(schluessel, wert); } catch (fehler) {}
  }
  function willkommenKommt() {
    if (/(?:^|[?&])willkommen=1(?:&|$)/.test(location.search)) return true;
    if (!document.querySelector("script[src*='willkommen.js']")) return false;
    return speicherLesen("ffw-willkommen") !== "gesehen";
  }
  function willkommenSichtbar() {
    return !!(document.querySelector(".wl") || document.documentElement.classList.contains("wl-offen"));
  }
  function hinweisWeg() {
    var feld = document.querySelector(".push-frage");
    if (feld) feld.remove();
  }
  function hinweisErlaubt() {
    if (document.querySelector(".push-frage")) return false;
    if (willkommenSichtbar()) return false;
    if (hinweisErzwingen) return !willkommenKommt();
    if (!initBekannt || abonniert) return false;
    if (speicherLesen(HINWEIS)) return false;
    if (typeof Notification !== "undefined" && Notification.permission === "denied") return false;
    if (willkommenKommt()) return false;
    return true;
  }
  function hinweisWarten() {
    if (hinweisWarten.laeuft) return;
    hinweisWarten.laeuft = true;
    var beobachter = new MutationObserver(function () {
      if (willkommenSichtbar() || willkommenKommt()) return;
      beobachter.disconnect();
      hinweisWarten.laeuft = false;
      hinweisZeigen();
    });
    beobachter.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
  }
  function hinweisZeigen() {
    if (!hinweisErlaubt()) {
      if (hinweisErzwingen && (willkommenSichtbar() || willkommenKommt())) hinweisWarten();
      return;
    }
    var feld = document.createElement("div");
    feld.className = "push-frage";
    feld.setAttribute("role", "dialog");
    feld.setAttribute("aria-modal", "true");
    feld.setAttribute("aria-labelledby", "push-frage-titel");
    var karte = document.createElement("div");
    karte.className = "push-frage-karte";
    var glocke = document.createElement("span");
    glocke.className = "push-frage-glocke";
    glocke.setAttribute("aria-hidden", "true");
    glocke.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M10 20a2 2 0 0 0 4 0"/></svg>';
    var text = document.createElement("p");
    text.id = "push-frage-titel";
    text.textContent = "Benachrichtigungen bei neuen Berichten einschalten?";
    var aktionen = document.createElement("div");
    aktionen.className = "push-frage-aktionen";
    var ein = document.createElement("button");
    ein.type = "button";
    ein.className = "push-frage-ein";
    ein.textContent = "Einschalten";
    var spaeter = document.createElement("button");
    spaeter.type = "button";
    spaeter.className = "push-frage-spaeter";
    spaeter.textContent = "Später";
    ein.addEventListener("click", function () {
      hinweisWeg();
      klick();
    });
    spaeter.addEventListener("click", function () {
      speicherSchreiben(HINWEIS, "spaeter");
      hinweisWeg();
    });
    aktionen.appendChild(ein);
    aktionen.appendChild(spaeter);
    karte.appendChild(glocke);
    karte.appendChild(text);
    karte.appendChild(aktionen);
    feld.appendChild(karte);
    document.body.appendChild(feld);
    try { ein.focus({ preventScroll: true }); } catch (fehler) { ein.focus(); }
  }
  function hinweisAktualisieren() {
    if (!hinweisErzwingen && document.querySelector(".push-frage") &&
        (abonniert || (typeof Notification !== "undefined" && Notification.permission === "denied"))) {
      hinweisWeg();
    }
    hinweisZeigen();
  }
  function aboLesen(OneSignal) {
    var abo = OneSignal.User && OneSignal.User.PushSubscription;
    abonniert = !!(abo && abo.optedIn);
    diagnose.optedIn = abonniert;
    diagnose.id = abo && abo.id || "";
    return abo;
  }
  function pushSupportedLesen(OneSignal) {
    var wert = "";
    try {
      if (OneSignal.Notifications && typeof OneSignal.Notifications.isPushSupported === "function") {
        wert = !!OneSignal.Notifications.isPushSupported();
      }
    } catch (fehler) {
      wert = false;
      diagnose.fehler = String(fehler && fehler.message || fehler);
    }
    diagnose.pushSupported = wert;
    return wert;
  }
  function nachOneSignal(arbeit, warnung) {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function (OneSignal) {
      diagnose.geladen = true;
      return mitTimeout(arbeit(OneSignal), warnung).then(function () {
        aboLesen(OneSignal);
        wartet = false;
        clearTimeout(optWatch);
        male();
      }).catch(function (fehler) {
        clearTimeout(optWatch);
        fehlgeschlagen(fehler, warnung);
      });
    });
  }


  var VAPID_PUBLIC = "BK7buPTNb5-mOXIB0zhVRc7yLwGrosM3gAQPXY9nKvMoN97sDVpIpYM0QPExh2RkBGr9so4bGB4Z1nhkO-EW0EM";
  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }
  function manuellAbonnieren() {
    if (!navigator.serviceWorker) return Promise.reject(new Error("kein Service Worker"));
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (existing) {
        if (existing) return existing;
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
        });
      });
    });
  }

  function beiOneSignalAnmelden(OneSignal, subscription) {
    if (!subscription) return Promise.resolve();
    var j = subscription.toJSON ? subscription.toJSON() : {};
    var body = {
      subscriptions: [{
        type: "SafariPush",
        token: j.endpoint || "",
        web_auth: (j.keys && j.keys.auth) || "",
        web_p256: (j.keys && j.keys.p256dh) || "",
        enabled: true,
        notification_types: 1
      }]
    };
    return fetch("https://api.onesignal.com/apps/" + APP + "/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (data) {
      diagnose.fehler = "";
      if (data && data.subscriptions && data.subscriptions[0]) {
        diagnose.id = data.subscriptions[0].id || "";
        abonniert = true;
        diagnose.optedIn = true;
      }
      return data;
    }).catch(function (fehler) {
      diagnose.fehler = "API: " + String(fehler && fehler.message || fehler);
      return null;
    });
  }
  function weiterNachErlaubnis(status) {
    if (!diagnose.schritte.erlaubnis) diagnose.schritte.erlaubnis = zeit();
    if (!diagnose.permissionNachPrompt) {
      var aktuell = typeof Notification !== "undefined" ? Notification.permission : "fehlt";
      diagnose.permissionNachPrompt = aktuell + (status ? " (Rückgabe: " + status + ")" : "");
    }
    debugZeichnen();
    if (erlaubnisLaeuft) return;
    erlaubnisLaeuft = true;
    if (status === "denied" || (typeof Notification !== "undefined" && Notification.permission === "denied")) {
      wartet = false;
      clearTimeout(optWatch);
      setze("Benachrichtigungen im Browser blockiert – in den Einstellungen erlauben", "blockiert");
      return;
    }
    if (initFehler) {
      wartet = false;
      clearTimeout(optWatch);
      debug = true;
      setze("Gerade nicht verfügbar, bitte später nochmal");
      debugZeichnen();
      return;
    }
    optBegrenzen();
    nachOneSignal(function (OneSignal) {
      var abo = aboLesen(OneSignal);
      if (abo && abo.optedIn) {
        diagnose.schritte.optInFertig = zeit();
        return null;
      }
      var unterstuetzt = pushSupportedLesen(OneSignal);
      var direkt = true; // immer direkt optIn, OneSignal.requestPermission hängt auf iOS
      diagnose.schritte.optInStart = zeit() + " (direkt optIn)";
      debugZeichnen();
      var arbeit;
      if (!abo) arbeit = Promise.reject(new Error("PushSubscription fehlt"));
      arbeit = abo.optIn();
      return Promise.race([
        Promise.resolve(arbeit),
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error("optIn Timeout")); }, 8000); })
      ]).catch(function (fehler) {
        diagnose.fehler = String(fehler && fehler.message || fehler);
        if (ios()) return manuellAbonnieren().then(function () { return "manuell"; });
        throw fehler;
      }).then(function (ergebnis) {
        diagnose.schritte.optInFertig = zeit() + (ergebnis === "manuell" ? " (manuell)" : "");
        if (ergebnis === "manuell") {
          return manuellAbonnieren().then(function (sub) {
            return beiOneSignalAnmelden(OneSignal, sub);
          }).then(function () { aboLesen(OneSignal); });
        }
        aboLesen(OneSignal);
      });
    }, "OneSignal optIn");
  }
  function klick() {
    diagnose.schritte.klick = zeit();
    erlaubnisLaeuft = false;
    if (ios() && !standalone()) {
      setze("Auf dem iPhone/iPad erst ‚Zum Home-Bildschirm‘ hinzufügen");
      return;
    }
    if (abonniert) {
      boxNachZehn();
      optBegrenzen();
      nachOneSignal(function (OneSignal) {
        diagnose.schritte.optInStart = zeit() + " (optOut)";
        return OneSignal.User.PushSubscription.optOut().then(function () {
          diagnose.schritte.optInFertig = zeit();
        });
      }, "OneSignal optOut");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setze("Benachrichtigungen im Browser blockiert – in den Einstellungen erlauben", "blockiert");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      var erlaubnis = Notification.requestPermission(function (status) { weiterNachErlaubnis(status); });
      if (!abschluss()) boxNachZehn();
      if (!erlaubnisLaeuft) {
        wartet = true;
        setze("Bitte erlauben …");
      }
      if (erlaubnis && typeof erlaubnis.then === "function") {
        erlaubnis.then(weiterNachErlaubnis).catch(function (fehler) {
          fehlgeschlagen(fehler, "Notification.requestPermission");
        });
      }
      return;
    }
    wartet = true;
    setze("Bitte erlauben …");
    boxNachZehn();
    weiterNachErlaubnis(typeof Notification !== "undefined" ? Notification.permission : "default");
  }
  function binden() {
    knoepfe().forEach(function (block) {
      var knopf = block.querySelector("[data-push-knopf]");
      if (!knopf || knopf.getAttribute("data-push-gebunden") === "1") return;
      knopf.setAttribute("data-push-gebunden", "1");
      knopf.addEventListener("click", klick);
    });
    male();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", binden);
  else binden();

  /* OneSignal registriert /sw.js selbst, mit ?appId=…&sdkVersion=…
     (SDK: register(workerPath + Query) und wartet, bis genau diese URL active ist).
     Eine eigene Registrierung ohne Query bleibt auf WebKit liegen; optIn wartet dann ewig.
     Doku: eine Registrierung pro Scope, eine geänderte Script-URL braucht eine Migration.
     https://documentation.onesignal.com/docs/en/onesignal-service-worker */
  function workerOhneAppId(url) {
    try {
      var adresse = new URL(url, location.href);
      if (!/\/sw\.js$/.test(adresse.pathname)) return false;
      return !adresse.searchParams.has("appId");
    } catch (fehler) {
      return false;
    }
  }
  function sitzung(name, wert) {
    try {
      if (arguments.length < 2) return sessionStorage.getItem(name);
      sessionStorage.setItem(name, wert);
    } catch (fehler) { return null; }
  }
  function alteRegistrierungWeg() {
    if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistrations) return Promise.resolve(false);
    return navigator.serviceWorker.getRegistrations().then(function (regs) {
      var jobs = (regs || []).map(function (reg) {
        var worker = reg.active || reg.waiting || reg.installing;
        if (!worker || !workerOhneAppId(worker.scriptURL)) return Promise.resolve(false);
        var abo = reg.pushManager && reg.pushManager.getSubscription ? reg.pushManager.getSubscription() : Promise.resolve(null);
        return abo.then(function (sub) {
          if (sub) return false;
          return reg.unregister().then(function () { return true; }, function () { return false; });
        });
      });
      return Promise.all(jobs).then(function (flags) {
        return flags.indexOf(true) !== -1;
      });
    });
  }

  function swRegistrieren() {
    if (!navigator.serviceWorker) return Promise.resolve(null);
    return navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(function (reg) {
        diagnose.swFehler = "";
        return reg;
      })
      .catch(function (fehler) {
        diagnose.swFehler = String(fehler && fehler.message || fehler);
        console.warn("SW register", fehler);
        return null;
      });
  }
  function oneSignalStarten() {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    initBegrenzen();
    window.OneSignalDeferred.push(function (OneSignal) {
    diagnose.geladen = true;
    diagnose.init = "läuft";
    pushSupportedLesen(OneSignal);
    debugZeichnen();
    return mitTimeout(OneSignal.init({
      appId: APP,
      serviceWorkerPath: "sw.js",
      serviceWorkerParam: { scope: "/" },
      notifyButton: { enable: false },
      welcomeNotification: { disable: true },
      promptOptions: { slidedown: { prompts: [{ type: "push", autoPrompt: false }] } }
    }), "OneSignal.init").then(function () {
      clearTimeout(initWatch);
      initBekannt = true;
      diagnose.init = "fertig";
      diagnose.schritte.init = zeit();
      pushSupportedLesen(OneSignal);
      aboLesen(OneSignal);
      OneSignal.User.PushSubscription.addEventListener("change", function () {
        abonniert = !!OneSignal.User.PushSubscription.optedIn;
        diagnose.optedIn = abonniert;
        diagnose.id = OneSignal.User.PushSubscription.id || "";
        wartet = false;
        male();
      });
      if (OneSignal.Notifications && OneSignal.Notifications.addEventListener) {
        OneSignal.Notifications.addEventListener("permissionChange", function () {
          wartet = false;
          male();
        });
      }
      male();
    }).catch(function (fehler) {
      clearTimeout(initWatch);
      diagnose.init = "Fehler";
      diagnose.schritte.init = zeit() + " (Fehler)";
      fehlgeschlagen(fehler, "OneSignal.init");
    });
  });
  }
  alteRegistrierungWeg().then(function (weg) {
    if (weg && sitzung("ffw-sw-reset") !== "1") {
      sitzung("ffw-sw-reset", "1");
      location.reload();
      return;
    }
    if (ios()) {
      swRegistrieren().then(function () { oneSignalStarten(); });
    } else {
      oneSignalStarten();
    }
  }).catch(function (fehler) {
    console.warn("Service Worker", fehler);
    oneSignalStarten();
  });
})();
