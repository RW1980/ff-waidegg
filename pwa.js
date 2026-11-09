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
    schritte: { klick: "", erlaubnis: "", init: "", optInStart: "", optInFertig: "" }
  };
  var initWatch = 0;
  var optWatch = 0;
  var boxTimer = 0;

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
    diagnose.fehler = text;
    debug = true;
    setze("Gerade nicht verfügbar, bitte später nochmal");
    debugZeichnen();
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
    var regPromise = navigator.serviceWorker ? navigator.serviceWorker.getRegistration("/") : Promise.resolve(null);
    regPromise.then(function (reg) {
      var sw = reg && (reg.active || reg.waiting || reg.installing);
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
          "SW-Controller: " + (navigator.serviceWorker && navigator.serviceWorker.controller ? "ja" : "nein"),
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
        bloecke.forEach(function (block) {
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
      var direkt = unterstuetzt === false || legacyErwartet();
      diagnose.schritte.optInStart = zeit() + (direkt ? " (direkt optIn)" : "");
      debugZeichnen();
      var arbeit;
      if (!abo) arbeit = Promise.reject(new Error("PushSubscription fehlt"));
      else if (direkt) arbeit = abo.optIn();
      else if (OneSignal.Notifications && OneSignal.Notifications.requestPermission) arbeit = OneSignal.Notifications.requestPermission();
      else arbeit = abo.optIn();
      return Promise.resolve(arbeit).then(function () {
        diagnose.schritte.optInFertig = zeit();
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

  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function (fehler) {
      console.warn("Service Worker", fehler);
      diagnose.fehler = diagnose.fehler || String(fehler && fehler.message || fehler);
      debug = true;
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", binden);
  else binden();

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
})();
