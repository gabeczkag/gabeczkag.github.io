const CLIENT_ID = "Iv23limKstWLUxYHjNeN";
const WORKER_URL = "https://gabeczkag-github-io.gabeczkaweb-authorization.workers.dev";
const SITE_ORIGIN = "https://gabeczkag.github.io";
const OWNER = "gabeczkag";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

async function handle(req) {
  const url = new URL(req.url);
  const cors = { "Access-Control-Allow-Origin": "*" };

  if (url.pathname === "/login") {
    const state = crypto.randomUUID();
    const redirect = "https://github.com/login/oauth/authorize?client_id=" + CLIENT_ID +
      "&redirect_uri=" + encodeURIComponent(WORKER_URL + "/callback") +
      "&state=" + state + "&scope=" + encodeURIComponent("repo read:user");
    return new Response(null, {
      status: 302,
      headers: {
        ...cors,
        location: redirect,
        "Set-Cookie": "oauth_state=" + state + "; HttpOnly; Secure; Path=/; Max-Age=300; SameSite=Lax"
      }
    });
  }

  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const m = (req.headers.get("cookie") || "").match(/oauth_state=([^;]+)/);
    if (!code || !state || !m || m[1] !== state) {
      return new Response("Bad state", { status: 400 });
    }
    const tokRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code })
    });
    const j = await tokRes.json();
    const access = j.access_token;
    if (!access) {
      return new Response("Brak tokena: " + JSON.stringify(j), { status: 400 });
    }
    const me = await (await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + access, Accept: "application/json" }
    })).json();
    if (me.login?.toLowerCase() !== OWNER) {
      return new Response("Brak dostepu", { status: 403 });
    }
    return new Response(null, {
      status: 302,
      headers: { ...cors, location: SITE_ORIGIN + "/admin/#token=" + encodeURIComponent(access) }
    });
  }

  if (url.pathname === "/me") {
    return json({ ok: true });
  }

  return new Response("Not found", { status: 404 });
}

addEventListener("fetch", event => {
  event.respondWith(
    handle(event.request).catch(e => new Response("Error: " + (e && e.stack ? e.stack : String(e)), { status: 500 }))
  );
});
