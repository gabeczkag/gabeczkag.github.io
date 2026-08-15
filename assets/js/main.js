const FALLBACK = [];

async function loadProjects() {
  try {
    const r = await fetch("projects.json", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d)) return { projects: d, favorites: [] };
      if (d && typeof d === 'object') {
        return {
          projects: Array.isArray(d.projects) ? d.projects : [],
          favorites: Array.isArray(d.favorites) ? d.favorites : []
        };
      }
    }
  } catch (e) {}
  return { projects: FALLBACK, favorites: [] };
}

function renderGrid(projects) {
  const grid = document.querySelector("[data-projects-grid]");
  if (!grid) return;
  grid.innerHTML = "";
  const count = document.querySelector("[data-projects-count]");
  if (!projects.length) {
    const empty = document.createElement("div");
    empty.className = "projects-empty";
    empty.innerHTML = '<p>Brak projektów do wyświetlenia.</p><p>Dodaj je w <a href="/admin/">panelu administratora</a>.</p>';
    grid.appendChild(empty);
    if (count) count.textContent = "0 projektów";
    return;
  }
  projects.forEach(p => {
    const card = document.createElement("article");
    card.className = "project-card";
    let imgHtml = "";
    if (p.image) imgHtml = `<img class="project-card-img" src="${p.image.replace(/"/g, '&quot;')}" alt="${p.name.replace(/"/g, '&quot;')}">`;
    card.innerHTML = imgHtml + '<h3></h3><p></p><a class="project-link" target="_blank" rel="noopener"></a>';
    card.querySelector("h3").textContent = p.name;
    card.querySelector("p").textContent = p.description || "";
    if (Array.isArray(p.endpoints) && p.endpoints.length) {
      const epWrap = document.createElement("div");
      epWrap.className = "project-endpoints";
      p.endpoints.forEach(e => {
        const chip = document.createElement("code");
        chip.className = "endpoint-chip";
        chip.textContent = e;
        epWrap.appendChild(chip);
      });
      card.insertBefore(epWrap, card.querySelector(".project-link"));
    }
    const link = card.querySelector(".project-link");
    link.href = `/projectspage.html?name=${encodeURIComponent(p.name)}`;
    link.textContent = "Otwórz →";
    grid.appendChild(card);
  });
  if (count) count.textContent = projects.length + (projects.length === 1 ? " projekt" : " projektów");
}

function renderFavorites(favorites) {
  const section = document.getElementById("favorites");
  const grid = document.querySelector("[data-favorites-grid]");
  const count = document.querySelector("[data-favorites-count]");
  if (!section || !grid) return;

  grid.innerHTML = "";
  if (!favorites.length) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  favorites.forEach(p => {
    const card = document.createElement("article");
    card.className = "project-card";
    let imgHtml = "";
    if (p.image) imgHtml = `<img class="project-card-img" src="${p.image.replace(/"/g, '&quot;')}" alt="${p.name.replace(/"/g, '&quot;')}">`;
    card.innerHTML = imgHtml + '<h3></h3><p></p><a class="project-link" target="_blank" rel="noopener"></a>';
    card.querySelector("h3").textContent = p.name;
    card.querySelector("p").textContent = p.description || "";
    if (Array.isArray(p.endpoints) && p.endpoints.length) {
      const epWrap = document.createElement("div");
      epWrap.className = "project-endpoints";
      p.endpoints.forEach(e => {
        const chip = document.createElement("code");
        chip.className = "endpoint-chip";
        chip.textContent = e;
        epWrap.appendChild(chip);
      });
      card.insertBefore(epWrap, card.querySelector(".project-link"));
    }
    const link = card.querySelector(".project-link");
    link.href = `/projectspage.html?name=${encodeURIComponent(p.name)}`;
    link.textContent = "Otwórz →";
    grid.appendChild(card);
  });
  if (count) count.textContent = favorites.length + (favorites.length === 1 ? " ulubiony" : " ulubionych");
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

document.addEventListener("DOMContentLoaded", async () => {
  const data = await loadProjects();
  renderGrid(data.projects);
  renderFavorites(data.favorites);
  setupMenu();
  setYear();
});
