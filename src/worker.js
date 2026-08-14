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

async function exchange(code) {
  if (typeof GITHUB_CLIENT_SECRET === "undefined") {
    throw new Error("BRAK SEKRETU GITHUB_CLIENT_SECRET w Cloudflare Variables");
  }
  const tokRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: "client_id=" + encodeURIComponent(CLIENT_ID) +
      "&client_secret=" + encodeURIComponent(GITHUB_CLIENT_SECRET) +
      "&code=" + encodeURIComponent(code) +
      "&redirect_uri=" + encodeURIComponent(WORKER_URL + "/callback")
  });
  const raw = await tokRes.text();
  let j;
  try {
    j = JSON.parse(raw);
  } catch (e) {
    j = Object.fromEntries(new URLSearchParams(raw));
  }
  if (!j.access_token) {
    throw new Error("EXCHANGE GitHub (" + tokRes.status + "): " + raw);
  }
  return j.access_token;
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

    let access, step = "exchange";
    try {
      access = await exchange(code);
      step = "user";
      const ures = await fetch("https://api.github.com/user", {
        headers: { Authorization: "Bearer " + access, Accept: "application/json" }
      });
      const uraw = await ures.text();
      let me;
      try { me = JSON.parse(uraw); } catch (e) {
        throw new Error("USER GitHub (" + ures.status + "): " + uraw);
      }
      if (me.login?.toLowerCase() !== OWNER) {
        throw new Error("Brak dostepu dla: " + me.login);
      }
      return new Response(null, {
        status: 302,
        headers: { ...cors, location: SITE_ORIGIN + "/admin/#token=" + encodeURIComponent(access) }
      });
    } catch (e) {
      return new Response("Krok: " + step + "\nBlad: " + e.message, { status: 502 });
    }
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
