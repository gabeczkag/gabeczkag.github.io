const OWNER = "gabeczkag";
const REPO = "gabeczkag/gabeczkag.github.io";
const PATH = "projects.json";

function b64url(u8) {
  return btoa(String.fromCharCode(...u8))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(s) { return b64url(new TextEncoder().encode(s)); }
function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function pemToDer(pem) {
  const b64 = pem.replace(/-----(BEGIN|END) [^-]+-----/g, "").replace(/\s+/g, "");
  return b64urlToBytes(b64);
}
function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...cors }
  });
}
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}

async function signHS(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const body = b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." +
    b64urlStr(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return body + "." + b64url(new Uint8Array(sig));
}
async function verifyHS(token, secret) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "HMAC", key, b64urlToBytes(parts[2]), enc.encode(parts[0] + "." + parts[1])
  );
  if (!ok) return null;
  try { return JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))); }
  catch { return null; }
}

async function appJwt(env) {
  const der = pemToDer(env.GITHUB_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 600, iss: env.GITHUB_APP_ID };
  const body = b64urlStr(JSON.stringify(header)) + "." + b64urlStr(JSON.stringify(payload));
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(body));
  return body + "." + b64url(new Uint8Array(sig));
}
async function installationToken(env) {
  const jwt = await appJwt(env);
  const r = await fetch(`https://api.github.com/app/installations/${env.INSTALLATION_ID}/access_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json", "User-Agent": "cf-worker" }
  });
  const j = await r.json();
  return j.token;
}
async function saveProjects(projects, env) {
  const tok = await installationToken(env);
  const get = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json" }
  });
  const sha = get.ok ? (await get.json()).sha : undefined;
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(projects, null, 2))));
  const put = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
    body: JSON.stringify({ message: "Aktualizacja projektow (GitHub App)", content, sha })
  });
  return put.ok;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(env.SITE_ORIGIN);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (url.pathname === "/login") {
      const state = crypto.randomUUID();
      const redirect = "https://github.com/login/oauth/authorize?client_id=" +
        env.GITHUB_CLIENT_ID + "&redirect_uri=" +
        encodeURIComponent(env.WORKER_URL + "/callback") + "&state=" + state + "&scope=read:user";
      return new Response(null, {
        status: 302,
        headers: { ...cors, location: redirect, "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; Path=/; Max-Age=300; SameSite=Lax` }
      });
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const m = (req.headers.get("cookie") || "").match(/oauth_state=([^;]+)/);
      if (!code || !state || !m || m[1] !== state) return json({ error: "bad state" }, 400, cors);
      const tokRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code })
      });
      const access = (await tokRes.json()).access_token;
      const me = await (await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${access}`, Accept: "application/json" }
      })).json();
      if (me.login?.toLowerCase() !== OWNER) return json({ error: "not owner" }, 403, cors);
      const sess = await signHS({ login: me.login, exp: Date.now() + 3600_000 }, env.SESSION_SECRET);
      return new Response(null, {
        status: 302,
        headers: { ...cors, location: env.SITE_ORIGIN + "/admin.html#token=" + encodeURIComponent(sess) }
      });
    }

    if (url.pathname === "/me") {
      const auth = await verifyHS(req.headers.get("authorization")?.replace("Bearer ", ""), env.SESSION_SECRET);
      return json({ auth: !!(auth && auth.login === OWNER) }, 200, cors);
    }

    if (url.pathname === "/save" && req.method === "POST") {
      const auth = await verifyHS(req.headers.get("authorization")?.replace("Bearer ", ""), env.SESSION_SECRET);
      if (!auth || auth.login !== OWNER) return json({ error: "unauthorized" }, 401, cors);
      let projects;
      try { projects = await req.json(); } catch { return json({ error: "bad json" }, 400, cors); }
      if (!Array.isArray(projects)) return json({ error: "expected array" }, 400, cors);
      const ok = await saveProjects(projects, env);
      return json({ ok }, ok ? 200 : 500, cors);
    }

    return json({ error: "not found" }, 404, cors);
  }
};
