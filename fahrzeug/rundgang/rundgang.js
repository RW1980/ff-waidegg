// Fahrzeug-Rundgang als Kameraflug: Zoomketten mit Ken-Burns und Überblendung zwischen den Fotos,
// Hotspots an den Standbildern, optional leichte 3D-Parallaxe aus Tiefenkarten (WebGL).
// Ohne JS bleiben die Fotos mit den Punktelisten sichtbar.
(function () {
  "use strict";
  var main = document.querySelector(".rundgang");
  if (!main || !main.animate) return;
  var secs = Array.prototype.slice.call(main.querySelectorAll(".rg-bild"));
  if (!secs.length) return;
  var ruhig = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function zahlen(s) { return s ? s.split(",").map(Number) : null; }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  var st = secs.map(function (sec) {
    var foto = sec.querySelector(".rg-foto"), img = foto.querySelector("img"), h = sec.querySelector("h2");
    return {
      sec: sec, id: sec.id, foto: foto, img: img,
      titel: h.lastChild.textContent.trim(),
      intro: (sec.querySelector("h2 + p") || {}).textContent || "",
      fahrt: sec.getAttribute("data-fahrt") || "",
      zoom: zahlen(sec.getAttribute("data-zoom")),
      start: zahlen(sec.getAttribute("data-start")),
      tiefe: sec.getAttribute("data-tiefe"),
      punkte: Array.prototype.slice.call(sec.querySelectorAll(".rg-punkte li"))
    };
  });

  // --- Aufbau Player ---
  var player = el("div", "rg-player");
  var titel = el("h2", "rg-titel", '<span class="rg-nr"></span> <span></span>');
  titel.tabIndex = -1;
  var intro = el("p", "rg-intro");
  var buehne = el("div", "rg-buehne");
  var startBtn = el("button", "rg-start", "▶ Kameraflug starten");
  startBtn.type = "button";
  var steuer = el("div", "rg-steuer");
  steuer.innerHTML = '<button type="button" class="rg-zurueck">← Zurück</button>' +
    '<button type="button" class="rg-play" aria-pressed="false">▶ Abspielen</button>' +
    '<button type="button" class="rg-weiter">Weiter →</button>' +
    '<span class="rg-stand" aria-live="polite"></span>';
  var info = el("div", "rg-info", '<h3></h3><p></p><button type="button" class="rg-zu">Schließen</button>');
  info.id = "rg-info";
  info.hidden = true;
  info.setAttribute("role", "region");
  info.setAttribute("aria-live", "polite");
  var neigen = el("button", "rg-neigen", "3D: Handy neigen");
  neigen.type = "button";
  neigen.hidden = true;
  var nav = el("nav", "rg-stationen");
  nav.setAttribute("aria-label", "Stationen");
  nav.appendChild(el("h2", "", "Stationen"));
  var gruppe = null, liste = null;
  st.forEach(function (s, i) {
    if (s.fahrt !== gruppe) {
      gruppe = s.fahrt;
      var g = el("div", "rg-gruppe");
      g.appendChild(el("h3")).textContent = gruppe;
      liste = g.appendChild(el("ol"));
      liste.start = i + 1;
      nav.appendChild(g);
    }
    var b = el("button");
    b.type = "button";
    b.textContent = s.titel;
    b.addEventListener("click", function () { spiel(false); geh(i, i === aktuell + 1); });
    s.navBtn = b;
    liste.appendChild(el("li")).appendChild(b);
  });
  [titel, intro, buehne, steuer, info, neigen, nav].forEach(function (e) { player.appendChild(e); });
  secs[0].parentNode.insertBefore(player, secs[0]);

  // Fotos auf die Bühne, Hotspots erzeugen
  st.forEach(function (s) {
    s.foto.style.setProperty("--ar", (s.img.getAttribute("width") / s.img.getAttribute("height")).toFixed(4));
    s.punkte.forEach(function (li, i) {
      var b = el("button", "rg-spot" + (li.classList.contains("rg-offen") ? " rg-offen" : ""));
      b.type = "button";
      b.style.left = li.getAttribute("data-x") + "%";
      b.style.top = li.getAttribute("data-y") + "%";
      b.textContent = String(i + 1);
      b.setAttribute("aria-label", "Punkt " + (i + 1) + ": " + li.querySelector("strong").textContent);
      b.setAttribute("aria-expanded", "false");
      b.setAttribute("aria-controls", info.id);
      b.addEventListener("click", function () { spiel(false); oeffnen(b, li); });
      s.foto.appendChild(b);
    });
    buehne.appendChild(s.foto);
  });
  buehne.appendChild(startBtn);

  // --- Infotext zu Hotspots ---
  var offen = null;
  function schliessen(fokus) {
    if (!offen) return;
    var b = offen;
    offen = null;
    b.setAttribute("aria-expanded", "false");
    info.hidden = true;
    if (fokus) b.focus();
  }
  function oeffnen(b, li) {
    var war = offen === b;
    schliessen(false);
    if (war) return;
    info.querySelector("h3").textContent = li.querySelector("strong").textContent;
    info.querySelector("p").textContent = li.textContent.replace(/^[^–]*–\s*/, "");
    info.hidden = false;
    b.setAttribute("aria-expanded", "true");
    offen = b;
    if (info.scrollIntoView) info.scrollIntoView({ block: "nearest" });
  }
  info.querySelector(".rg-zu").addEventListener("click", function () { schliessen(true); });

  // --- Kameraflug ---
  var aktuell = 0, token = 0, laufend = [], spielen = false, timer = 0;
  var zurueck = steuer.querySelector(".rg-zurueck"), weiter = steuer.querySelector(".rg-weiter");
  var playBtn = steuer.querySelector(".rg-play"), stand = steuer.querySelector(".rg-stand");

  function anim(e, kf, opt) {
    var a = e.animate(kf, opt);
    laufend.push(a);
    return a.finished.catch(function () {});
  }
  function stopAnims() {
    laufend.forEach(function (a) { try { a.cancel(); } catch (x) {} });
    laufend = [];
  }
  function bereit(img) {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    img.loading = "eager";
    return new Promise(function (ok) {
      img.addEventListener("load", ok, { once: true });
      img.addEventListener("error", ok, { once: true });
      setTimeout(ok, 5000);
    });
  }
  function text(n) {
    var s = st[n];
    titel.firstChild.textContent = (n + 1) + " von " + st.length;
    titel.lastChild.textContent = s.titel;
    intro.textContent = s.intro;
    stand.textContent = "Station " + (n + 1) + " von " + st.length + ": " + s.titel;
    zurueck.disabled = n === 0;
    weiter.disabled = n === st.length - 1;
    st.forEach(function (o, i) {
      if (i === n) o.navBtn.setAttribute("aria-current", "step");
      else o.navBtn.removeAttribute("aria-current");
    });
    if (history.replaceState) history.replaceState(null, "", "#" + s.id);
  }
  function zeigeNur(n) {
    st.forEach(function (s, i) {
      s.foto.classList.toggle("an", i === n);
      s.foto.style.zIndex = "";
    });
  }
  function geh(n, flug) {
    if (n < 0 || n >= st.length) return;
    var my = ++token;
    clearTimeout(timer);
    stopAnims();
    schliessen(false);
    tiefeAus();
    startBtn.hidden = true;
    var A = st[aktuell], B = st[n];
    zeigeNur(aktuell);
    aktuell = n;
    text(n);
    if (st[n + 1]) st[n + 1].img.loading = "eager"; // nur die nächste Station vorladen
    buehne.classList.add("rg-flug");
    var weg = Promise.resolve();
    if (ruhig || A === B) {
      weg = bereit(B.img).then(function () { zeigeNur(n); });
    } else {
      var z = flug && B.zoom;
      if (z) {
        A.img.style.transformOrigin = z[0] + "% " + z[1] + "%";
        weg = anim(A.img, [{ transform: "none" },
          { transform: "translate(" + (50 - z[0]) + "%," + (50 - z[1]) + "%) scale(" + z[2] + ")" }],
          { duration: 1700, easing: "cubic-bezier(.45,0,.75,.6)", fill: "forwards" });
      }
      weg = Promise.all([weg, bereit(B.img)]).then(function () {
        if (my !== token) return;
        B.foto.classList.add("an");
        B.foto.style.zIndex = 2;
        var p = B.start || [50, 50];
        B.img.style.transformOrigin = p[0] + "% " + p[1] + "%";
        var k = z ? 1.35 : (B.start ? 1.3 : 1.08);
        var fade = anim(B.foto, [{ opacity: 0 }, { opacity: 1 }], { duration: z ? 650 : 500, fill: "both" });
        var kb = anim(B.img, [{ transform: "scale(" + k + ")" }, { transform: "none" }],
          { duration: z || B.start ? 2200 : 1100, easing: "cubic-bezier(.2,.6,.3,1)", fill: "both" });
        return fade.then(function () {
          if (my !== token) return;
          A.foto.classList.remove("an");
          return kb;
        });
      });
    }
    weg.then(function () {
      if (my !== token) return;
      stopAnims();
      zeigeNur(n);
      st.forEach(function (s) { s.img.style.transformOrigin = ""; });
      buehne.classList.remove("rg-flug");
      tiefeAn(B);
      if (spielen) {
        if (n < st.length - 1) timer = setTimeout(function () { geh(aktuell + 1, true); }, 4500);
        else spiel(false);
      }
    });
  }
  function spiel(an) {
    spielen = an;
    clearTimeout(timer);
    playBtn.setAttribute("aria-pressed", an ? "true" : "false");
    playBtn.textContent = an ? "❚❚ Pause" : "▶ Abspielen";
  }
  playBtn.addEventListener("click", function () {
    if (spielen) { spiel(false); return; }
    spiel(true);
    geh(aktuell < st.length - 1 ? aktuell + 1 : 0, aktuell < st.length - 1);
  });
  startBtn.addEventListener("click", function () {
    spiel(true);
    geh(1, true);
    titel.focus({ preventScroll: true });
  });
  zurueck.addEventListener("click", function () { spiel(false); geh(aktuell - 1, false); });
  weiter.addEventListener("click", function () { spiel(false); geh(aktuell + 1, true); });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && offen) { schliessen(true); return; }
    if (!player.contains(document.activeElement) || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key === "ArrowRight") { spiel(false); geh(aktuell + 1, true); ev.preventDefault(); }
    if (ev.key === "ArrowLeft") { spiel(false); geh(aktuell - 1, false); ev.preventDefault(); }
  });
  document.addEventListener("click", function (ev) {
    if (offen && !ev.target.closest(".rg-spot, .rg-info")) schliessen(false);
  });

  // --- Tiefeneffekt (WebGL) ---
  var gl = null, cv = null, prog = null, texF = null, texT = null, ziel = [0, 0], ist = [0, 0], raf = 0, tiefeOk = false, tiefeStation = null;
  function initGL() {
    if (ruhig) return;
    cv = el("canvas", "rg-tiefe");
    cv.setAttribute("aria-hidden", "true");
    try { gl = cv.getContext("webgl", { premultipliedAlpha: false }); } catch (x) { gl = null; }
    if (!gl) return;
    function sh(typ, src) {
      var s = gl.createShader(typ);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, "precision mediump float;uniform sampler2D f;uniform sampler2D t;uniform vec2 m;varying vec2 v;" +
      "void main(){vec2 u=.5+(v-.5)*.97;float d=texture2D(t,u).r;gl_FragColor=texture2D(f,clamp(u+m*(d-.4)*.025,0.,1.));}"));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    texF = tex(0);
    texT = tex(1);
    gl.uniform1i(gl.getUniformLocation(prog, "f"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "t"), 1);
    buehne.addEventListener("pointermove", function (ev) {
      if (ev.pointerType !== "mouse") return;
      var r = buehne.getBoundingClientRect();
      bewege((ev.clientX - r.left) / r.width * 2 - 1, (ev.clientY - r.top) / r.height * 2 - 1);
    });
    buehne.addEventListener("pointerleave", function () { bewege(0, 0); });
    if ("DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches) {
      neigen.hidden = false;
      neigen.addEventListener("click", function () {
        var D = window.DeviceOrientationEvent;
        var ok = D.requestPermission ? D.requestPermission() : Promise.resolve("granted");
        ok.then(function (r) {
          if (r !== "granted") return;
          neigen.hidden = true;
          var basis = null;
          window.addEventListener("deviceorientation", function (e) {
            if (e.beta == null) return;
            if (basis === null) basis = e.beta;
            bewege(Math.max(-1, Math.min(1, e.gamma / 25)), Math.max(-1, Math.min(1, (e.beta - basis) / 25)));
          });
        }).catch(function () {});
      });
    }
  }
  function tex(unit) {
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE); });
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }
  function lade(unit, t, bild) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, bild);
  }
  function bewege(x, y) {
    ziel = [x, y];
    if (tiefeOk && !raf) raf = requestAnimationFrame(male);
  }
  function male() {
    raf = 0;
    if (!tiefeOk) return;
    ist[0] += (ziel[0] - ist[0]) * 0.12;
    ist[1] += (ziel[1] - ist[1]) * 0.12;
    gl.uniform2f(gl.getUniformLocation(prog, "m"), -ist[0], -ist[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (Math.abs(ziel[0] - ist[0]) + Math.abs(ziel[1] - ist[1]) > 0.002) raf = requestAnimationFrame(male);
  }
  function tiefeAus() {
    tiefeOk = false;
    tiefeStation = null;
    if (cv) cv.classList.remove("an");
  }
  function tiefeAn(s) {
    if (!gl || !s.tiefe) return;
    tiefeStation = s;
    var t = new Image();
    t.onload = function () {
      if (tiefeStation !== s) return;
      var r = s.foto.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      lade(0, texF, s.img);
      lade(1, texT, t);
      s.foto.insertBefore(cv, s.img.nextSibling);
      tiefeOk = true;
      ist = [ziel[0], ziel[1]];
      male();
      cv.classList.add("an");
    };
    t.src = s.tiefe;
  }

  // --- Start ---
  main.classList.add("rg-an");
  initGL();
  var start = 0;
  st.forEach(function (s, i) { if (location.hash === "#" + s.id) start = i; });
  aktuell = start;
  zeigeNur(start);
  text(start);
  if (start > 0) startBtn.hidden = true;
  if (st[start + 1]) st[start + 1].img.loading = "eager";
  bereit(st[start].img).then(function () { if (aktuell === start) tiefeAn(st[start]); });
})();
