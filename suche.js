// Suche im Berichte-Archiv. Nutzt den Pagefind-Index unter /pagefind/ (liegt auf diesem Server, keine externen Anfragen).
(function () {
  const form = document.querySelector("[data-suche]");
  if (!form) return;
  const feld = form.querySelector("input");
  const status = form.querySelector(".suche-status");
  const liste = document.getElementById("suche-treffer");
  let pf = null;
  let lauf = 0;

  async function laden() {
    if (!pf) {
      pf = await import("/pagefind/pagefind.js");
      await pf.options({ excerptLength: 22 });
      pf.init();
    }
    return pf;
  }

  function leeren() {
    liste.replaceChildren();
    liste.hidden = true;
    status.textContent = "";
  }

  async function suchen(text) {
    const nr = ++lauf;
    const q = text.trim();
    if (q.length < 2) { leeren(); return; }
    status.textContent = "Suche läuft …";
    try {
      const p = await laden();
      const ergebnis = await p.debouncedSearch(q, {}, 250);
      if (ergebnis === null || nr !== lauf) return;
      const daten = await Promise.all(ergebnis.results.slice(0, 30).map((r) => r.data()));
      if (nr !== lauf) return;
      liste.replaceChildren();
      daten.forEach((d) => {
        const a = document.createElement("a");
        a.className = "card";
        a.href = d.url;
        const jahr = (d.url.match(/\/berichte\/(\d{4})\//) || [])[1];
        if (jahr) {
          const t = document.createElement("time");
          t.dateTime = jahr;
          t.textContent = jahr;
          a.appendChild(t);
        }
        const h = document.createElement("h3");
        h.textContent = (d.meta && d.meta.title) || d.url;
        const ex = document.createElement("p");
        ex.innerHTML = d.excerpt; // von Pagefind aus unseren eigenen Texten erzeugt, mit <mark> für Treffer
        a.append(h, ex);
        liste.appendChild(a);
      });
      const n = ergebnis.results.length;
      liste.hidden = n === 0;
      status.textContent = n === 0
        ? "Keine Berichte zu „" + q + "“ gefunden."
        : n + (n === 1 ? " Bericht" : " Berichte") + " zu „" + q + "“" + (n > 30 ? ", die 30 besten werden gezeigt." : ".");
    } catch (e) {
      status.textContent = "Die Suche ist gerade nicht verfügbar.";
    }
  }

  feld.addEventListener("input", () => suchen(feld.value));
  feld.addEventListener("focus", () => { laden().catch(() => {}); }, { once: true });
  form.addEventListener("submit", (event) => { event.preventDefault(); suchen(feld.value); });

  const start = new URLSearchParams(location.search).get("suche");
  if (start) { feld.value = start; suchen(start); }
})();
