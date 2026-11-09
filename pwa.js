/* OneSignal (Web SDK v16): ein Service Worker (sw.js), keine Glocke, kein Popup von selbst.
   Der Knopf [data-push] ist sofort klickbar. Safari/WebKit verlangt, dass
   Notification.requestPermission() noch im Klick selbst aufgerufen wird. */
(function () {
  var APP = "0cff0d8c-39b6-497b-bf07-d6c2e58a03fa";
  var abonniert = false;
  var initFehler = false;
  var wartet = false;
  var erlaubnisLaeuft = false;
  var debug = /(?:^|[?&])pushdebug=1(?:&|$)/.test(location.search);
  var diagnose = { geladen: false, init: "nein", fehler: "", optedIn: false, id: "" };

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
  function debugZeichnen() {
    if (!debug) return;
    var bloecke = knoepfe();
    var regPromise = navigator.serviceWorker ? navigator.serviceWorker.getRegistration("/") : Promise.resolve(null);
    regPromise.then(function (reg) {
      var sw = reg && (reg.active || reg.waiting || reg.installing);
      var zeilen = [
        "UA: " + navigator.userAgent,
        "standalone: " + (standalone() ? "ja" : "nein"),
        "Notification.permission: " + (typeof Notification !== "undefined" ? Notification.permission : "fehlt"),
        "PushManager: " + ("PushManager" in window ? "ja" : "nein"),
        "SW: " + (sw ? sw.scriptURL + " " + sw.state : "keine"),
        "OneSignal geladen: " + (diagnose.geladen ? "ja" : "nein"),
        "init: " + diagnose.init,
        "Fehler: " + (diagnose.fehler || "–"),
        "optedIn: " + (diagnose.optedIn ? "ja" : "nein"),
        "Abo-ID: " + kuerzen(diagnose.id)
      ].join("\n");
      bloecke.forEach(function (block) {
        var box = block.querySelector("[data-push-debug]");
        if (!box) {
          box = document.createElement("pre");
          box.setAttribute("data-push-debug", "1");
          box.style.cssText = "margin:.45rem 0 0;padding:.5rem;max-width:100%;overflow:auto;white-space:pre-wrap;word-break:break-word;font:12px/1.45 ui-monospace,monospace;background:#fff;border:1px solid #d4cbbc;color:#1c1b19;";
          block.appendChild(box);
        }
        box.textContent = zeilen;
      });
    }).catch(function (fehler) {
      console.warn("pushdebug", fehler);
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
  function nachOneSignal(arbeit, warnung) {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function (OneSignal) {
      diagnose.geladen = true;
      return mitTimeout(arbeit(OneSignal), warnung).then(function () {
        var abo = OneSignal.User && OneSignal.User.PushSubscription;
        abonniert = !!(abo && abo.optedIn);
        diagnose.optedIn = abonniert;
        diagnose.id = abo && abo.id || "";
        wartet = false;
        male();
      }).catch(function (fehler) {
        console.warn(warnung, fehler);
        wartet = false;
        initFehler = true;
        diagnose.fehler = String(fehler && fehler.message || fehler);
        setze("Gerade nicht verfügbar, bitte später nochmal");
        debugZeichnen();
      });
    });
  }
  function weiterNachErlaubnis(status) {
    if (erlaubnisLaeuft) return;
    erlaubnisLaeuft = true;
    if (status === "denied" || (typeof Notification !== "undefined" && Notification.permission === "denied")) {
      wartet = false;
      setze("Benachrichtigungen im Browser blockiert – in den Einstellungen erlauben", "blockiert");
      return;
    }
    if (initFehler) {
      wartet = false;
      setze("Gerade nicht verfügbar, bitte später nochmal");
      return;
    }
    nachOneSignal(function (OneSignal) {
      var abo = OneSignal.User.PushSubscription;
      if (abo.optedIn) return null;
      if (OneSignal.Notifications && OneSignal.Notifications.requestPermission) return OneSignal.Notifications.requestPermission();
      return abo.optIn();
    }, "OneSignal optIn");
  }
  function klick() {
    erlaubnisLaeuft = false;
    if (ios() && !standalone()) {
      setze("Auf dem iPhone/iPad erst ‚Zum Home-Bildschirm‘ hinzufügen");
      return;
    }
    if (abonniert) {
      nachOneSignal(function (OneSignal) {
        return OneSignal.User.PushSubscription.optOut();
      }, "OneSignal optOut");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setze("Benachrichtigungen im Browser blockiert – in den Einstellungen erlauben", "blockiert");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      var erlaubnis = Notification.requestPermission(function (status) { weiterNachErlaubnis(status); });
      if (!erlaubnisLaeuft) {
        wartet = true;
        setze("Bitte erlauben …");
      }
      if (erlaubnis && typeof erlaubnis.then === "function") {
        erlaubnis.then(weiterNachErlaubnis).catch(function (fehler) {
          console.warn("Notification.requestPermission", fehler);
          wartet = false;
          setze("Gerade nicht verfügbar, bitte später nochmal");
        });
      }
      return;
    }
    wartet = true;
    setze("Bitte erlauben …");
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
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", binden);
  else binden();

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(function (OneSignal) {
    diagnose.geladen = true;
    diagnose.init = "läuft";
    debugZeichnen();
    return mitTimeout(OneSignal.init({
      appId: APP,
      serviceWorkerPath: "sw.js",
      serviceWorkerParam: { scope: "/" },
      notifyButton: { enable: false },
      welcomeNotification: { disable: true },
      promptOptions: { slidedown: { prompts: [{ type: "push", autoPrompt: false }] } }
    }), "OneSignal.init").then(function () {
      diagnose.init = "fertig";
      var abo = OneSignal.User && OneSignal.User.PushSubscription;
      abonniert = !!(abo && abo.optedIn);
      diagnose.optedIn = abonniert;
      diagnose.id = abo && abo.id || "";
      OneSignal.User.PushSubscription.addEventListener("change", function () {
        abonniert = !!OneSignal.User.PushSubscription.optedIn;
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
      console.warn("OneSignal.init", fehler);
      initFehler = true;
      wartet = false;
      diagnose.init = "Fehler";
      diagnose.fehler = String(fehler && fehler.message || fehler);
      male();
    });
  });
})();
