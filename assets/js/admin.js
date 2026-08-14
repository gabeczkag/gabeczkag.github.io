const OWNER = "gabeczkag";
const REPO = "gabeczkag.github.io";
const PATH = "projects.json";
const WORKER_URL = "https://gabeczkag-github-io.gabeczkaweb-authorization.workers.dev";

const $ = id => document.getElementById(id);

function getToken() {
  const m = document.cookie.match(/(?:^|;\s*)gw_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}
function setToken(t) {
  document.cookie = "gw_token=" + encodeURIComponent(t) + "; max-age=2592000; path=/; Secure; SameSite=Lax";
}
function clearToken() {
  document.cookie = "gw_token=; max-age=0; path=/; Secure; SameSite=Lax";
}

let projects = [];
let token = getToken();

function b64(str) {
  return btoa(unescape(encodeURIComponent(str)));
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
    clearToken();
    $("authmsg").textContent = "Brak dostępu. Upewnij się, że token ma scope „repo” i należy do konta " + OWNER + ".";
  }
}

async function load() {
  try {
    const r = await fetch("/projects.json", { cache: "no-store" });
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
  location.href = WORKER_URL + "/login";
};

$("loginToken").onclick = async () => {
  token = $("token").value.trim();
  if (!token) { $("authmsg").textContent = "Wpisz token."; return; }
  setToken(token);
  await enter();
};

$("logout").onclick = () => {
  token = "";
  clearToken();
  location.reload();
};

$("quickAdd").onclick = async () => {
  const input = $("repoUrl").value.trim();
  const m = input.match(/github\.com\/([^\/\s?#]+)\/([^\/\s?#]+)/);
  if (!m) { $("quickmsg").textContent = "Podaj poprawny link do repozytorium GitHub."; return; }
  const owner = m[1], repoName = m[2].replace(/\.git$/, "");
  $("quickmsg").textContent = "Pobieranie danych repozytorium...";
  try {
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = "Bearer " + token;
    const r = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
    if (!r.ok) { $("quickmsg").textContent = "Nie znaleziono repo (" + r.status + "). Sprawdź link i czy repo jest publiczne."; return; }
    const repo = await r.json();
    projects.push({ name: repo.name, url: repo.html_url, description: repo.description || "" });
    render();
    $("repoUrl").value = "";
    $("quickmsg").textContent = "Dodano „" + repo.name + "”. Kliknij „Zapisz do GitHub”, by zapisać.";
  } catch (e) {
    $("quickmsg").textContent = "Błąd sieci: " + e.message;
  }
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
    if (put.ok) $("status").textContent = "Zapisano ✓ Strona odświeży się za 1–2 min (GitHub Pages).";
    else {
      const e = await put.json().catch(() => ({}));
      let msg = e.message || ("HTTP " + put.status);
      if (put.status === 401 || put.status === 403) {
        msg += " — token musi mieć uprawnienia do zapisu. Przy logowaniu przez GitHub upewnij się, że to OAuth App (nie GitHub App) z scope 'repo'; przy PAT użyj tokena klasycznego z 'repo'.";
      }
      $("status").textContent = "Błąd: " + msg;
    }
  } catch (e) {
    $("status").textContent = "Błąd sieci: " + e.message;
  }
}
$("save").onclick = save;

(async () => {
  if (location.hash.startsWith("#token=")) {
    token = decodeURIComponent(location.hash.slice(7));
    setToken(token);
    history.replaceState(null, "", location.pathname);
    await enter();
  } else {
    await enter();
  }
})();
