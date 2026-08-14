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
let favorites = [];
let effects = { plasma: true, heroBlobs: true, cardHover: true };
let token = getToken();
let quickData = null;

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
    renderImageExplorer();
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
      if (Array.isArray(d)) {
        projects = d;
      } else if (d && typeof d === 'object') {
        projects = Array.isArray(d.projects) ? d.projects : [];
        effects = { ...effects, ...(d.effects || {}) };
        favorites = Array.isArray(d.favorites) ? d.favorites : [];
      }
    }
  } catch (e) {}
  renderEffects();
  renderImageExplorer();
  render();
}

function renderEffects() {
  const fx = {
    "fx-plasma": effects.plasma,
    "fx-hero-blobs": effects.heroBlobs,
    "fx-card-hover": effects.cardHover
  };
  for (const [id, val] of Object.entries(fx)) {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  }
}

function renderImageExplorer() {
  const grid = $("imageExplorerGrid");
  if (!grid) return;
  grid.innerHTML = '<p class="admin-warn">Ładowanie...</p>';
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/assets/images`;
  fetch(url, { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" } })
    .then(r => {
      console.log("[imageExplorer] status", r.status);
      if (r.status === 404) {
        grid.innerHTML = "";
        const presetsTitle = document.createElement("p");
        presetsTitle.className = "image-explorer-title";
        presetsTitle.textContent = "Ikony FontAwesome (presety)";
        grid.appendChild(presetsTitle);
        const presetsGrid = document.createElement("div");
        presetsGrid.className = "image-explorer-grid fa-presets-grid";
        presetsGrid.innerHTML = `{preset_html}`;
        presetsGrid.querySelectorAll(".fa-preset").forEach(card => {
          card.addEventListener("click", () => {
            const url = card.getAttribute("data-url");
            $("imagePreviewImg").src = url;
            $("imagePreview").hidden = false;
            $("image").value = url;
          });
        });
        grid.appendChild(presetsGrid);
        const warn = document.createElement("p");
        warn.className = "admin-warn";
        warn.textContent = "Katalog assets/images/ jeszcze nie istnieje na GitHubie. Wgraj obraz, aby go utworzyć.";
        grid.appendChild(warn);
        return null;
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(files => {
      console.log("[imageExplorer] files", files);
      grid.innerHTML = "";
      // FA presets section
      const presetsTitle = document.createElement("p");
      presetsTitle.className = "image-explorer-title";
      presetsTitle.textContent = "Ikony FontAwesome (presety)";
      grid.appendChild(presetsTitle);
      const presetsGrid = document.createElement("div");
      presetsGrid.className = "image-explorer-grid fa-presets-grid";
      presetsGrid.innerHTML = `{preset_html}`;
      presetsGrid.querySelectorAll(".fa-preset").forEach(card => {
        card.addEventListener("click", () => {
          const url = card.getAttribute("data-url");
          $("imagePreviewImg").src = url;
          $("imagePreview").hidden = false;
          $("image").value = url;
        });
      });
      grid.appendChild(presetsGrid);
      // Separator
      const sep = document.createElement("p");
      sep.className = "image-explorer-title";
      sep.textContent = "Z repozytorium (assets/images/)";
      grid.appendChild(sep);
      const filesGrid = document.createElement("div");
      filesGrid.className = "image-explorer-grid";
      grid.appendChild(filesGrid);
      if (!Array.isArray(files) || !files.length) {
        const empty = document.createElement("p");
        empty.className = "admin-warn";
        empty.textContent = "Brak obrazów w assets/images/";
        filesGrid.appendChild(empty);
        return;
      }
      
      files.forEach(f => {
        const card = document.createElement("div");
        card.className = "explorer-card";
        const img = document.createElement("img");
        img.src = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/assets/images/${f.name}`;
        img.alt = f.name;
        img.loading = "lazy";
        const name = document.createElement("span");
        name.className = "explorer-name";
        name.textContent = f.name;
        const use = document.createElement("button");
        use.type = "button";
        use.className = "btn btn-ghost";
        use.textContent = "Użyj";
        use.onclick = () => {
          $("image").value = `assets/images/${f.name}`;
          $("imagePreviewImg").src = img.src;
          $("imagePreview").hidden = false;
        };
        card.append(img, name, use);
        filesGrid.appendChild(card);
      });
    })
    .catch(err => {
      console.warn("[imageExplorer] error", err);
      grid.innerHTML = '<p class="admin-warn">Nie udało się załadować obrazów. Sprawdź konsolę i czy jesteś zalogowany.</p>';
    });
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
    if (p.image) {
      const thumb = document.createElement("img");
      thumb.src = p.image;
      thumb.alt = p.name;
      thumb.className = "adm-thumb";
      info.insertBefore(thumb, info.firstChild);
    }
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

  const favList = $("fav-list");
  if (favList) {
    favList.innerHTML = "";
    favorites.forEach((p, i) => {
      const li = document.createElement("li");
      const info = document.createElement("div");
      info.innerHTML = "<strong></strong><span class=\"adm-url\"></span><p></p>";
      info.querySelector("strong").textContent = p.name;
      info.querySelector(".adm-url").textContent = p.url;
      info.querySelector("p").textContent = p.description || "";
      const actions = document.createElement("div");
      actions.className = "adm-row";
      const del = document.createElement("button");
      del.className = "btn btn-ghost";
      del.textContent = "Usuń";
      del.onclick = () => { favorites.splice(i, 1); render(); };
      actions.append(del);
      li.append(info, actions);
      favList.append(li);
    });
  }
}

function edit(i) {
  const p = projects[i];
  $("idx").value = i;
  $("name").value = p.name;
  $("url").value = p.url;
  $("desc").value = p.description || "";
  $("image").value = p.image || "";
}

$("edit").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("name").value.trim();
  const url = $("url").value.trim();
  const description = $("desc").value.trim();
  if (!name || name.length > 80) { alert("Nazwa: 1–80 znaków."); return; }
  if (!/^https?:\/\//i.test(url)) { alert("URL musi zaczynać się od http:// lub https://"); return; }
  if (description.length > 500) { alert("Opis: maks. 500 znaków."); return; }
  const image = $("image").value.trim();
  const p = { name, url, description };
  if (image) p.image = image;
  const i = $("idx").value;
  if (i === "") projects.push(p);
  else projects[+i] = p;
  $("idx").value = "";
  $("edit").reset();
  render();
});

$("cancel").onclick = () => { $("idx").value = ""; $("edit").reset(); };

["fx-plasma", "fx-hero-blobs", "fx-card-hover"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    effects[id.replace("fx-", "")] = el.checked;
  });
});

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
    quickData = { name: repo.name, url: repo.html_url, description: repo.description || "" };
    $("qp-name").textContent = quickData.name;
    $("qp-url").textContent = quickData.url;
    $("qp-url").href = quickData.url;
    $("qp-desc").textContent = quickData.description || "Brak opisu";
    $("qp-desc-edit").value = quickData.description || "";
    $("quick-preview").hidden = false;
    $("quickmsg").textContent = "";
  } catch (e) {
    $("quickmsg").textContent = "Błąd sieci: " + e.message;
  }
};

$("qp-add").onclick = () => {
  if (!quickData) return;
  const name = quickData.name;
  const description = $("qp-desc-edit").value.trim();
  projects.push({ name: quickData.name, url: quickData.url, description });
  render();
  $("quick-preview").hidden = true;
  quickData = null;
  $("repoUrl").value = "";
  $("quickmsg").textContent = "Dodano „" + name + "”. Kliknij „Zapisz do GitHub”, by zapisać.";
};

$("qp-cancel").onclick = () => {
  $("quick-preview").hidden = true;
  quickData = null;
  $("quickmsg").textContent = "";
};

$("addFav").onclick = async () => {
  const input = $("favUrl").value.trim();
  const m = input.match(/github\.com\/([^\/\s?#]+)\/([^\/\s?#]+)/);
  if (!m) { alert("Podaj poprawny link do repozytorium GitHub."); return; }
  const owner = m[1], repoName = m[2].replace(/\.git$/, "");
  try {
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = "Bearer " + token;
    const r = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
    if (!r.ok) { alert("Nie znaleziono repo (" + r.status + ")"); return; }
    const repo = await r.json();
    favorites.push({ name: repo.name, url: repo.html_url, description: repo.description || "" });
    render();
    $("favUrl").value = "";
  } catch (e) {
    alert("Błąd sieci: " + e.message);
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
    const payload = { projects, effects, favorites };
    const content = b64(JSON.stringify(payload, null, 2));
    const put = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
      body: JSON.stringify({ message: "Aktualizacja projektow (panel)", content, sha: data.sha })
    });
    if (put.ok) {
      $("status").textContent = "Zapisano ✓ Strona odświeży się za 1–2 min (GitHub Pages).";
      renderImageExplorer();
    }
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

$("browseImage").onclick = () => $("imageFile").click();
$("imageFile").onchange = () => {
  const file = $("imageFile").files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    $("imagePreviewImg").src = e.target.result;
    $("imagePreview").hidden = false;
    $("image").value = "";
  };
  reader.readAsDataURL(file);
};
$("clearImage").onclick = () => {
  $("image").value = "";
  $("imagePreview").hidden = true;
  $("imageFile").value = "";
};

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
