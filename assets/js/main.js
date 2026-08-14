const FALLBACK = [];

async function loadProjects() {
  try {
    const r = await fetch("projects.json", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d) && d.length) return d;
    }
  } catch (e) {}
  try {
    const ls = localStorage.getItem("gw_projects");
    if (ls) {
      const d = JSON.parse(ls);
      if (Array.isArray(d)) return d;
    }
  } catch (e) {}
  return FALLBACK;
}

function renderNav(projects) {
  const slot = document.querySelector("[data-projects-nav]");
  if (!slot) return;
  slot.innerHTML = "";
  projects.forEach(p => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = p.url;
    a.textContent = p.name;
    a.target = "_blank";
    a.rel = "noopener";
    li.appendChild(a);
    slot.appendChild(li);
  });
}

function renderGrid(projects) {
  const grid = document.querySelector("[data-projects-grid]");
  if (!grid) return;
  grid.innerHTML = "";
  const count = document.querySelector("[data-projects-count]");
  if (!projects.length) {
    const empty = document.createElement("div");
    empty.className = "projects-empty";
    empty.innerHTML = '<p>Brak projektów do wyświetlenia.</p><p>Dodaj je w <a href="admin.html">panelu administratora</a>.</p>';
    grid.appendChild(empty);
    if (count) count.textContent = "0 projektów";
    return;
  }
  projects.forEach(p => {
    const card = document.createElement("article");
    card.className = "project-card";
    card.innerHTML = '<h3></h3><p></p><a class="project-link" target="_blank" rel="noopener"></a>';
    card.querySelector("h3").textContent = p.name;
    card.querySelector("p").textContent = p.description || "";
    const link = card.querySelector(".project-link");
    link.href = p.url;
    link.textContent = "Otwórz →";
    grid.appendChild(card);
  });
  if (count) count.textContent = projects.length + (projects.length === 1 ? " projekt" : " projektów");
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
  const projects = await loadProjects();
  renderNav(projects);
  renderGrid(projects);
  setupMenu();
  setYear();
});
