/* FF Waidegg – Terminhinweis „Einsatz-Pager“ (Startseite)
   Keine externen Ressourcen, kein Tracking, keine Cookies. Einziger Speicher: localStorage-Eintrag
   „ff-termin-weg:<uid>“, wenn jemand den Hinweis ausblendet (neuer Termin = neue uid = wieder sichtbar).
   Konfiguration ausschließlich über data-Attribute am Element [data-termin] in index.html. */
(function (w) {
  "use strict";
  var WTAG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  var WTAG_K = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  var MONAT = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  var MONAT_K = ["Jän", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  function zwei(n) { return (n < 10 ? "0" : "") + n; }

  /* "2026-10-31T18:00+01:00" -> Wandzeit (für Anzeige und .ics) + absoluter Zeitpunkt (für Countdown) */
  function zeit(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(s || "");
    if (!m) return null;
    var off = m[6] || "+01:00";
    return { j: +m[1], mo: +m[2], t: +m[3], h: +m[4], mi: +m[5], off: off,
      ms: Date.parse(m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":00" + off) };
  }
  function plusStunden(z, std) {
    var d = new Date(Date.UTC(z.j, z.mo - 1, z.t, z.h + std, z.mi));
    return { j: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, t: d.getUTCDate(), h: d.getUTCHours(),
      mi: d.getUTCMinutes(), off: z.off, ms: z.ms + std * 36e5 };
  }
  function wtag(z) { return new Date(Date.UTC(z.j, z.mo - 1, z.t)).getUTCDay(); }
  function iso(z) { return z.j + "-" + zwei(z.mo) + "-" + zwei(z.t) + "T" + zwei(z.h) + ":" + zwei(z.mi) + z.off; }
  function wand(z) { return z.j + zwei(z.mo) + zwei(z.t) + "T" + zwei(z.h) + zwei(z.mi) + "00"; }

  function lesen(d) { /* d = dataset oder einfaches Objekt */
    var start = zeit(d.start);
    if (!start) return null;
    var ende = zeit(d.ende) || plusStunden(start, +(d.dauer || 3));
    var bis = /^\d{4}-\d{2}-\d{2}$/.test(d.bis || "") ? Date.parse(d.bis + "T00:00:00" + start.off) : ende.ms;
    return {
      titel: d.titel || "", zusatz: d.zusatz || "", stichwort: d.stichwort || ("TERMIN – " + (d.titel || "")).toUpperCase(),
      ort: d.ort || "", start: start, ende: ende, bis: bis,
      uid: d.uid || ("termin-" + wand(start) + "@ff-waidegg.at"),
      link: d.link || "https://ff-waidegg.at/", datei: d.datei || "termin.ics", ics: d.ics || ""
    };
  }

  function datumLang(z) { return WTAG[wtag(z)] + ", " + z.t + ". " + MONAT[z.mo - 1] + " " + z.j; }
  function uhr(z) { return zwei(z.h) + ":" + zwei(z.mi) + " Uhr"; }
  function volltitel(c) { return (c.titel + " " + c.zusatz).trim(); }

  /* ---------- .ics (RFC 5545) ---------- */
  function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function falten(zeile) {
    var enc = new TextEncoder(), out = [], cur = "", n = 0;
    for (var ch of zeile) {
      var b = enc.encode(ch).length;
      if (n + b > 75) { out.push(cur); cur = " "; n = 1; }
      cur += ch; n += b;
    }
    out.push(cur);
    return out.join("\r\n");
  }
  function stempel(ms) { return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function ics(c, jetzt) {
    var z = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FF Waidegg//Termine//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE", "TZID:Europe/Vienna",
      "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
      "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD", "END:VTIMEZONE",
      "BEGIN:VEVENT", "UID:" + c.uid, "DTSTAMP:" + stempel(jetzt),
      "DTSTART;TZID=Europe/Vienna:" + wand(c.start), "DTEND;TZID=Europe/Vienna:" + wand(c.ende),
      "SUMMARY:" + esc(volltitel(c)), "LOCATION:" + esc(c.ort),
      "DESCRIPTION:" + esc(volltitel(c) + "\n" + datumLang(c.start) + ", " + uhr(c.start) + "\n" + c.ort + "\n" + c.link),
      "URL:" + c.link, "END:VEVENT", "END:VCALENDAR"
    ];
    return z.map(falten).join("\r\n") + "\r\n";
  }

  function whatsapp(c) {
    var text = "\uD83D\uDE92 " + volltitel(c) + "\n" + datumLang(c.start) + ", " + uhr(c.start) + "\n" + c.ort + "\n" + c.link;
    return "https://wa.me/?text=" + encodeURIComponent(text);
  }

  function rest(c, jetzt) {
    var diff = c.start.ms - jetzt;
    if (diff <= 0) return { status: jetzt < c.ende.ms ? "laeuft" : "vorbei" };
    var min = Math.floor(diff / 6e4);
    return { status: "bald", tage: Math.floor(min / 1440), std: Math.floor((min % 1440) / 60), min: min % 60 };
  }
  function restText(r) {
    if (r.status === "laeuft") return "Läuft gerade";
    if (r.status === "vorbei") return "Danke fürs Dabeisein";
    if (r.tage >= 1) return "Noch " + r.tage + (r.tage === 1 ? " Tag" : " Tage") + " und " + r.std + " Std.";
    return "Noch " + r.std + " Std. und " + r.min + " Min.";
  }
  function restKurz(r) {
    if (r.status !== "bald") return r.status === "laeuft" ? "LÄUFT" : "VORBEI";
    return "NOCH " + zwei(r.tage) + " T " + zwei(r.std) + " STD";
  }

  var API = { lesen: lesen, ics: ics, whatsapp: whatsapp, rest: rest, restText: restText, datumLang: datumLang, uhr: uhr };
  w.FFTermin = API;
  if (!w.document) return; /* z. B. Node: nur reine Funktionen */

  var d = w.document;
  function alle(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function setze(root, feld, txt) { alle(root, '[data-feld="' + feld + '"]').forEach(function (e) { e.textContent = txt; }); }
  function gespeichert(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function speichern(k) { try { w.localStorage.setItem(k, "1"); } catch (e) { /* privat-modus: egal */ } }

  function init(root) {
    var c = lesen(root.dataset);
    if (!c) return;
    var weg = "ff-termin-weg:" + c.uid;
    if (Date.now() >= c.bis || gespeichert(weg)) { root.hidden = true; return; }

    var s = c.start;
    setze(root, "titel", c.titel);
    setze(root, "zusatz", c.zusatz);
    setze(root, "stichwort", c.stichwort);
    setze(root, "ort", c.ort);
    setze(root, "datum", datumLang(s));
    setze(root, "uhrzeit", uhr(s));
    setze(root, "tag", String(s.t));
    setze(root, "monat", MONAT_K[s.mo - 1]);
    setze(root, "monat-lang", MONAT[s.mo - 1]);
    setze(root, "wochentag", WTAG[wtag(s)]);
    setze(root, "wochentag-kurz", WTAG_K[wtag(s)]);
    setze(root, "kurz", WTAG_K[wtag(s)] + " " + zwei(s.t) + "." + zwei(s.mo) + ".");
    setze(root, "kurz-num", (WTAG_K[wtag(s)] + " " + zwei(s.t) + "." + zwei(s.mo) + "." + s.j + " " + zwei(s.h) + ":" + zwei(s.mi)).toUpperCase());
    /* <time> wird erst hier erzeugt, damit das HTML ohne Skript gültig bleibt und der Termin nur einmal (in den data-Attributen) steht */
    alle(root, "[data-zeit=start]").forEach(function (e) {
      var t = d.createElement("time");
      t.setAttribute("datetime", iso(s));
      t.textContent = datumLang(s) + ", " + uhr(s);
      e.textContent = "";
      e.appendChild(t);
    });

    var icsHref = c.ics;
    if (!icsHref) {
      icsHref = URL.createObjectURL(new Blob([ics(c, Date.now())], { type: "text/calendar;charset=utf-8" }));
    }
    alle(root, "[data-aktion=ics]").forEach(function (a) {
      a.href = icsHref;
      /* statische Datei: normal öffnen (iOS bietet dann „Zum Kalender hinzufügen“); Blob: als Datei speichern */
      if (c.ics) a.removeAttribute("download"); else a.setAttribute("download", c.datei);
      a.hidden = false;
    });
    alle(root, "[data-aktion=teilen]").forEach(function (a) { a.href = whatsapp(c); a.hidden = false; });

    /* Countdown: sichtbare Ziffern aria-hidden, Klartext für Screenreader ohne aria-live (kein Dauer-Ansagen) */
    function tick() {
      var r = rest(c, Date.now());
      root.setAttribute("data-status", r.status);
      alle(root, "[data-cd=text]").forEach(function (e) { e.textContent = restText(r); });
      alle(root, "[data-cd=kurz]").forEach(function (e) { e.textContent = restKurz(r); });
      ["tage", "std", "min"].forEach(function (k) {
        alle(root, "[data-cd=" + k + "]").forEach(function (e) { e.textContent = r.status === "bald" ? String(r[k]) : "–"; });
      });
      if (Date.now() >= c.bis) root.hidden = true;
    }
    tick();
    var uhrwerk = w.setInterval(tick, 30000);
    d.addEventListener("visibilitychange", function () {
      if (d.hidden) { w.clearInterval(uhrwerk); } else { tick(); uhrwerk = w.setInterval(tick, 30000); }
    });

    /* Aufklappen: echter <button> mit aria-expanded, Escape schließt, Fokus wird geführt */
    var btn = root.querySelector("[data-termin-toggle]");
    function offen() { return root.classList.contains("is-offen"); }
    function schalten(auf, fokus) {
      root.classList.toggle("is-offen", auf);
      if (btn) btn.setAttribute("aria-expanded", auf ? "true" : "false");
      if (auf) { tick(); }
      if (auf && fokus) {
        var f = root.querySelector("[data-termin-fokus]");
        if (f) w.setTimeout(function () { f.focus({ preventScroll: true }); }, 30);
      }
      if (!auf && fokus && btn) btn.focus({ preventScroll: true });
    }
    if (btn) btn.addEventListener("click", function () { schalten(!offen(), true); });
    alle(root, "[data-termin-zu]").forEach(function (b) { b.addEventListener("click", function () { schalten(false, true); }); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && offen()) { schalten(false, true); }
    });
    d.addEventListener("pointerdown", function (e) {
      if (offen() && !root.contains(e.target)) schalten(false, false);
    });
    alle(root, "[data-termin-weg]").forEach(function (b) {
      b.addEventListener("click", function () {
        speichern(weg);
        root.hidden = true;
        var m = d.querySelector("main");
        if (m) { m.setAttribute("tabindex", "-1"); m.focus({ preventScroll: true }); }
      });
    });

    root.classList.add("is-bereit");
  }

  function start() { alle(d, "[data-termin]").forEach(init); }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
