// Chronik: sanftes Einblenden beim Scrollen und aktives Kapitel in der Sprungleiste.
// Ohne JavaScript oder bei "Bewegung reduzieren" ist alles sofort sichtbar.
(function () {
  const root = document.documentElement;
  const eintraege = document.querySelectorAll(".zr-eintrag, .zr-kopf");
  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ("IntersectionObserver" in window && !ruhig) {
    root.classList.add("zr-anim");
    const zeigen = new IntersectionObserver((liste) => {
      liste.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("zr-da"); zeigen.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    eintraege.forEach((el) => zeigen.observe(el));
    // Sprung per Anker: Ziel sofort sichtbar machen
    window.addEventListener("hashchange", () => {
      const ziel = document.getElementById(location.hash.slice(1));
      if (ziel) ziel.querySelectorAll(".zr-eintrag, .zr-kopf").forEach((el) => el.classList.add("zr-da"));
    });
  }
  const leiste = document.querySelector(".zr-sprung");
  // Sprungleiste genau unter die (je nach Gerät unterschiedlich hohe) Kopfzeile setzen
  const kopf = document.querySelector(".site-head");
  if (kopf && leiste) {
    const setzen = () => root.style.setProperty("--zr-kopf", Math.round(kopf.getBoundingClientRect().height) + "px");
    setzen();
    if ("ResizeObserver" in window) new ResizeObserver(setzen).observe(kopf); else window.addEventListener("resize", setzen);
  }
  if (!leiste || !("IntersectionObserver" in window)) return;
  const links = new Map();
  leiste.querySelectorAll("a").forEach((a) => links.set(a.getAttribute("href").slice(1), a));
  const aktiv = new IntersectionObserver((liste) => {
    liste.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.removeAttribute("aria-current"));
      const a = links.get(e.target.id);
      if (a) {
        a.setAttribute("aria-current", "true");
        if (leiste.scrollWidth > leiste.clientWidth) {
          leiste.scrollLeft = a.offsetLeft - leiste.clientWidth / 2 + a.offsetWidth / 2; // sofort, sonst bricht Chrome den Seiten-Sprung ab
        }
      }
    });
  }, { rootMargin: "-35% 0px -60% 0px" });
  document.querySelectorAll(".zr-kapitel").forEach((s) => aktiv.observe(s));
})();
