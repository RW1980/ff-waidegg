(function () {
  const links = Array.from(document.querySelectorAll(".gallery a"));
  if (!links.length) return;

  const box = document.createElement("div");
  box.className = "lightbox";
  box.hidden = true;
  box.innerHTML = `
    <button class="lb-close" type="button" aria-label="Schließen">×</button>
    <button class="lb-prev" type="button" aria-label="Vorheriges Bild">‹</button>
    <figure>
      <img alt="">
      <figcaption></figcaption>
    </figure>
    <button class="lb-next" type="button" aria-label="Nächstes Bild">›</button>
  `;
  document.body.appendChild(box);

  const img = box.querySelector("img");
  const cap = box.querySelector("figcaption");
  let index = 0;

  function show(i) {
    index = (i + links.length) % links.length;
    const link = links[index];
    const source = link.querySelector("img");
    img.src = link.getAttribute("href");
    img.alt = source ? source.alt : "";
    cap.textContent = links.length > 1 ? `${index + 1} / ${links.length}` : "";
    box.hidden = false;
    document.body.classList.add("lb-open");
  }

  function close() {
    box.hidden = true;
    img.src = "";
    document.body.classList.remove("lb-open");
  }

  links.forEach((link, i) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      show(i);
    });
  });

  box.querySelector(".lb-close").addEventListener("click", close);
  box.querySelector(".lb-prev").addEventListener("click", () => show(index - 1));
  box.querySelector(".lb-next").addEventListener("click", () => show(index + 1));
  box.addEventListener("click", (event) => {
    if (event.target === box) close();
  });
  document.addEventListener("keydown", (event) => {
    if (box.hidden) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") show(index - 1);
    if (event.key === "ArrowRight") show(index + 1);
  });
})();
