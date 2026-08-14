const WORKER = "https://gabeczkaweb-authorization.karczmarczykgrzegorz78.workers.dev";
const $ = id => document.getElementById(id);

let projects = [];
let session = sessionStorage.getItem("gw_session") || "";

function parseHash() {
  if (location.hash.startsWith("#token=")) {
    session = decodeURIComponent(location.hash.slice(7));
    sessionStorage.setItem("gw_session", session);
    history.replaceState(null, "", location.pathname + location.search);
  }
}

async function checkAuth() {
  if (!session) return false;
  try {
    const r = await fetch(WORKER + "/me", { headers: { Authorization: "Bearer " + session } });
    const j = await r.json();
    return !!j.auth;
  } catch (e) {
    return false;
  }
}

async function load() {
  try {
    const r = await fetch("projects.json", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d)) projects = d;
    }
  } catch (e) {}
  render();
}

function render() {
  $("cnt").textContent = projects.length + (projects.length === 1 ? " projekt" : " projektów");
  const list = $("list");
  list.innerHTML = "";
  projects.forEach((p, i) => {
    const li = document.createElement("li");
    const info = document.createElement("div");
    info.innerHTML = "<strong></strong><span class=\"adm-url\"></span><p></p>";
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

$("login").onclick = () => { window.location = WORKER + "/login"; };

$("logout").onclick = () => {
  session = "";
  sessionStorage.removeItem("gw_session");
  location.reload();
};

async function save() {
  if (!session) { $("status").textContent = "Nie jesteś zalogowany."; return; }
  $("status").textContent = "Zapisywanie...";
  try {
    const r = await fetch(WORKER + "/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session },
      body: JSON.stringify(projects)
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) $("status").textContent = "Zapisano. Strona zaktualizuje się za chwilę.";
    else $("status").textContent = "Błąd: " + (j.error || r.status);
  } catch (e) {
    $("status").textContent = "Błąd sieci: " + e.message;
  }
}
$("save").onclick = save;

(async () => {
  parseHash();
  if (await checkAuth()) {
    $("auth").hidden = true;
    $("panel").hidden = false;
    await load();
  } else {
    sessionStorage.removeItem("gw_session");
  }
})();
