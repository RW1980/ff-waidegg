/* OneSignal (Web SDK v16): ein Service Worker (sw.js), keine Glocke, kein Popup von selbst.
   Der Knopf [data-push] fragt erst beim Klick. */
(function () {
  var APP = "0cff0d8c-39b6-497b-bf07-d6c2e58a03fa";

  function ios() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function standalone() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  function bind(OneSignal) {
    var blocks = document.querySelectorAll("[data-push]");
    if (!blocks.length) return;
    var supported = OneSignal.Notifications.isPushSupported();

    function paint() {
      var an = !!(OneSignal.User && OneSignal.User.PushSubscription && OneSignal.User.PushSubscription.optedIn);
      var blockiert = typeof Notification !== "undefined" && Notification.permission === "denied";
      blocks.forEach(function (block) {
        var knopf = block.querySelector("[data-push-knopf]");
        var label = block.querySelector("[data-push-label]");
        var hinweis = block.querySelector("[data-push-ios]");
        if (!knopf || !label) return;
        if (ios() && !standalone() && hinweis) hinweis.hidden = false;
        if (!supported && !(ios() && !standalone())) {
          label.textContent = "In diesem Browser nicht verfügbar";
          knopf.disabled = true;
          knopf.setAttribute("aria-pressed", "false");
          return;
        }
        if (blockiert && !an) {
          label.textContent = "Benachrichtigungen im Browser blockiert";
          knopf.disabled = true;
          knopf.setAttribute("data-push-status", "blockiert");
          knopf.setAttribute("aria-pressed", "false");
          return;
        }
        knopf.disabled = false;
        if (an) {
          label.textContent = "Benachrichtigungen aktiv · Abbestellen";
          knopf.setAttribute("data-push-status", "aktiv");
          knopf.setAttribute("aria-pressed", "true");
        } else {
          label.textContent = "Benachrichtigungen bei neuen Berichten";
          knopf.removeAttribute("data-push-status");
          knopf.setAttribute("aria-pressed", "false");
        }
      });
    }

    blocks.forEach(function (block) {
      var knopf = block.querySelector("[data-push-knopf]");
      if (!knopf) return;
      knopf.addEventListener("click", function () {
        var abo = OneSignal.User.PushSubscription;
        var lauf = abo.optedIn ? abo.optOut() : (OneSignal.Notifications.isPushSupported() ? abo.optIn() : Promise.resolve());
        Promise.resolve(lauf).then(paint).catch(paint);
      });
    });

    OneSignal.User.PushSubscription.addEventListener("change", paint);
    OneSignal.Notifications.addEventListener("permissionChange", paint);
    paint();
  }

  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(function (OneSignal) {
    return OneSignal.init({
      appId: APP,
      serviceWorkerPath: "sw.js",
      serviceWorkerParam: { scope: "/" },
      notifyButton: { enable: false },
      welcomeNotification: { disable: true },
      promptOptions: { slidedown: { prompts: [{ type: "push", autoPrompt: false }] } }
    }).then(function () { bind(OneSignal); }).catch(function () {});
  });
})();
