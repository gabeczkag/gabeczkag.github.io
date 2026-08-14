const CLIENT_ID = "Iv23limKstWLUxYHjNeN";
const OWNER = "gabeczkag";
const REPO = "gabeczkag.github.io";
const PATH = "projects.json";

const $ = id => document.getElementById(id);

let projects = [];
let token = sessionStorage.getItem("gw_token") || "";

function b64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function exchange(code, state) {
  const saved = sessionStorage.getItem("gw_state");
  if (state && saved && state !== saved) {
    $("authmsg").textContent = "Błąd: niezgodny parametr state.";
    return;
  }
  sessionStorage.removeItem("gw_state");
  try {
    const r = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, code })
    });
    const j = await r.json();
    if (j.access_token) {
      token = j.access_token;
      sessionStorage.setItem("gw_token", token);
      await enter();
    } else {
      $("authmsg").textContent = "Błąd logowania: " + (j.error_description || j.error || "brak tokena");
    }
  } catch (e) {
    $("authmsg").textContent = "Błąd sieci: " + e.message;
  }
}

async function checkAuth() {
  if (!token) return false;
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    });
    if (!r.ok) return false;
    const me = await r.json();
    return me.login?.toLowerCase() === OWNER;
  } catch {
    return false;
  }
}

async function enter() {
  if (await checkAuth()) {
    $("auth").hidden = true;
    $("panel").hidden = false;
    await load();
  } else {
    token = "";
    sessionStorage.removeItem("gw_token");
    $("authmsg").textContent = "Brak dostępu. Musisz być właścicielem konta " + OWNER + ".";
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

$("login").onclick = () => {
  const state = crypto.randomUUID();
  sessionStorage.setItem("gw_state", state);
  const redirect = location.origin + location.pathname;
  const url = "https://github.com/login/oauth/authorize?client_id=" + CLIENT_ID +
    "&redirect_uri=" + encodeURIComponent(redirect) +
    "&scope=" + encodeURIComponent("repo read:user") +
    "&state=" + state;
  location.href = url;
};

$("logout").onclick = () => {
  token = "";
  sessionStorage.removeItem("gw_token");
  location.reload();
};

async function save() {
  if (!token) { $("status").textContent = "Nie jesteś zalogowany."; return; }
  $("status").textContent = "Zapisywanie...";
  try {
    const get = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`, {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }
    });
    const data = get.ok ? await get.json() : { sha: undefined };
    const content = b64(JSON.stringify(projects, null, 2));
    const put = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
      body: JSON.stringify({ message: "Aktualizacja projektow (panel)", content, sha: data.sha })
    });
    if (put.ok) $("status").textContent = "Zapisano. Strona zaktualizuje się za chwilę.";
    else { const e = await put.json().catch(() => ({})); $("status").textContent = "Błąd: " + (e.message || put.status); }
  } catch (e) {
    $("status").textContent = "Błąd sieci: " + e.message;
  }
}
$("save").onclick = save;

(async () => {
  const u = new URL(location.href);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  if (code) {
    history.replaceState(null, "", location.pathname);
    await exchange(code, state);
  } else {
    await enter();
  }
})();
