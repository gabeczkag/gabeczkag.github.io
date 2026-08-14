const REPO = "gabeczkag/gabeczkag.github.io";
const OWNER = "gabeczkag";
const PATH = "projects.json";
let projects = [];
let token = "";

const $ = id => document.getElementById(id);

async function loadRemote() {
  try {
    const r = await fetch(PATH, { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d)) return d;
    }
  } catch (e) {}
  return null;
}

async function open() {
  token = $("token").value.trim();
  if (!token) { alert("Wpisz token GitHub."); return; }
  try {
    const u = await fetch("https://api.github.com/user", { headers: { Authorization: `token ${token}` } });
    if (!u.ok) { alert("Nieprawidłowy token lub brak uprawnień."); return; }
    const me = await u.json();
    if (me.login.toLowerCase() !== OWNER) {
      alert("Ten token nie należy do właściciela konta " + OWNER + ". Odmowa dostępu.");
      return;
    }
  } catch (e) {
    alert("Błąd weryfikacji tożsamości: " + e.message);
    return;
  }
  sessionStorage.setItem("gw_token", token);
  let data = await loadRemote();
  if (!data) {
    try {
      const ls = localStorage.getItem("gw_projects");
      if (ls) data = JSON.parse(ls);
    } catch (e) {}
  }
  projects = Array.isArray(data) ? data : [];
  $("panel").hidden = false;
  render();
}

function render() {
  $("cnt").textContent = projects.length + (projects.length === 1 ? " projekt" : " projektów");
  const list = $("list");
  list.innerHTML = "";
  projects.forEach((p, i) => {
    const li = document.createElement("li");

    const info = document.createElement("div");
    info.innerHTML = '<strong></strong><span class="adm-url"></span><p></p>';
    info.querySelector("strong").textContent = p.name;
    info.querySelector(".adm-url").textContent = p.url;
    info.querySelector("p").textContent = p.description || "";

    const actions = document.createElement("div");
    actions.className = "adm-row";
    const ed = document.createElement("button");
    ed.className = "btn btn-ghost";
    ed.textContent = "Edytuj";
    ed.onclick = () => edit(i);
    const del = document.createElement("button");
    del.className = "btn btn-ghost";
    del.textContent = "Usuń";
    del.onclick = () => { projects.splice(i, 1); render(); };
    actions.append(ed, del);

    li.append(info, actions);
    list.append(li);
  });
}

function edit(i) {
  const p = projects[i];
  $("idx").value = i;
  $("name").value = p.name;
  $("url").value = p.url;
  $("desc").value = p.description || "";
}

$("edit").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("name").value.trim();
  const url = $("url").value.trim();
  const description = $("desc").value.trim();
  if (!name || name.length > 80) { alert("Nazwa: 1–80 znaków."); return; }
  if (!/^https?:\/\//i.test(url)) { alert("URL musi zaczynać się od http:// lub https://"); return; }
  if (description.length > 500) { alert("Opis: maks. 500 znaków."); return; }
  const p = { name, url, description };
  const i = $("idx").value;
  if (i === "") projects.push(p);
  else projects[+i] = p;
  $("idx").value = "";
  $("edit").reset();
  render();
});

$("cancel").onclick = () => { $("idx").value = ""; $("edit").reset(); };

function saveLocal() {
  localStorage.setItem("gw_projects", JSON.stringify(projects));
  $("status").textContent = "Zapisano lokalnie. Odśwież stronę główną, by zobaczyć.";
}

async function saveGh() {
  if (!token) { alert("Brak tokena."); return; }
  const body = JSON.stringify(projects, null, 2);
  const enc = btoa(unescape(encodeURIComponent(body)));
  try {
    const get = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
      headers: { Authorization: `token ${token}` }
    });
    const sha = get.ok ? (await get.json()).sha : undefined;
    const put = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
      method: "PUT",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Aktualizacja projektów (panel admin)",
        content: enc,
        sha
      })
    });
    if (put.ok) {
      localStorage.removeItem("gw_projects");
      $("status").textContent = "Zapisano do GitHub. Strona zaktualizuje się po kilku sekundach.";
    } else {
      const j = await put.json().catch(() => ({}));
      $("status").textContent = "Błąd: " + (j.message || put.status);
    }
  } catch (e) {
    $("status").textContent = "Błąd sieci: " + e.message;
  }
}

$("open").onclick = open;
$("saveGh").onclick = saveGh;
$("saveLocal").onclick = saveLocal;

(function init() {
  const t = sessionStorage.getItem("gw_token");
  if (t) $("token").value = t;
})();
