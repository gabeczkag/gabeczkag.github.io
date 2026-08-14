const projects = [
  { name: "Projekt Alpha", url: "https://github.com/GabeczkaG", description: "Krótki opis projektu Alpha. Zmień nazwę, URL i opis." },
  { name: "Projekt Beta", url: "https://github.com/GabeczkaG", description: "Krótki opis projektu Beta. Tu wpisz, czym się zajmuje." },
  { name: "Projekt Gamma", url: "https://github.com/GabeczkaG", description: "Krótki opis projektu Gamma. Dodaj kolejne obiekty do tablicy." }
];

function renderNav() {
  const navSlot = document.querySelector("[data-projects-nav]");
  if (!navSlot) return;
  navSlot.innerHTML = "";
  projects.forEach(p => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = p.url;
    a.textContent = p.name;
    a.target = "_blank";
    a.rel = "noopener";
    li.appendChild(a);
    navSlot.appendChild(li);
  });
}

function renderGrid() {
  const grid = document.querySelector("[data-projects-grid]");
  if (!grid) return;
  grid.innerHTML = "";
  projects.forEach(p => {
    const card = document.createElement("article");
    card.className = "project-card";
    card.innerHTML =
      '<h3></h3><p></p><a class="project-link" target="_blank" rel="noopener"></a>';
    card.querySelector("h3").textContent = p.name;
    card.querySelector("p").textContent = p.description;
    const link = card.querySelector(".project-link");
    link.href = p.url;
    link.textContent = "Otwórz →";
    grid.appendChild(card);
  });
}

function setupMenu() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-menu");
  if (!toggle || !menu) return;
  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  menu.addEventListener("click", e => {
    if (e.target.tagName === "A") {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function setYear() {
  const el = document.querySelector("[data-year]");
  if (el) el.textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", () => {
  renderNav();
  renderGrid();
  setupMenu();
  setYear();
});
