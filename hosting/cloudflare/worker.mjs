// Workers Free test adapter. All data access uses the signed-in owner's JWT and RLS.
const accessName = "sb-gts-free-test-auth-token";
const refreshName = accessName + ".1";
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function json(body, status = 200) {
  return Response.json(body, { status, headers });
}
const fail = (status, message) =>
  json({ error: { code: status, message } }, status);
function cookies(req) {
  return Object.fromEntries(
    (req.headers.get("cookie") || "")
      .split(";")
      .map((s) => s.trim())
      .map((s) => [s.split("=")[0], s.slice(s.indexOf("=") + 1)]),
  );
}
function putCookies(res, session) {
  for (const [name, value, ttl] of [
    [accessName, session?.access_token, session?.expires_in],
    [refreshName, session?.refresh_token, 2592000],
  ]) {
    res.headers.append(
      "Set-Cookie",
      name +
        "=" +
        (value || "") +
        "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=" +
        (value ? ttl : 0),
    );
  }
  return res;
}
function configured(env) {
  try {
    const url = new URL(env.SUPABASE_URL);
    return (
      url.protocol === "https:" &&
      env.SUPABASE_URL === url.origin &&
      !!(env.SUPABASE_PUBLISHABLE_KEY && env.OWNER_USER_ID)
    );
  } catch {
    return false;
  }
}
function upstream(env, path, method, body, token) {
  return fetch(env.SUPABASE_URL + path, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function grant(env, type, body) {
  const r = await upstream(
    env,
    "/auth/v1/token?grant_type=" + type,
    "POST",
    body,
  );
  if (!r.ok)
    return {
      error: fail(
        r.status === 429 ? 429 : r.status >= 500 ? 502 : 401,
        "인증 요청을 완료할 수 없습니다.",
      ),
    };
  const s = await r.json();
  if (s.user?.id !== env.OWNER_USER_ID)
    return { error: fail(403, "이 계정에는 접근 권한이 없습니다.") };
  if (!s.access_token || !s.refresh_token || !Number.isFinite(s.expires_in))
    throw Error("invalid session");
  return { session: s };
}
async function api(req, env) {
  const path = new URL(req.url).pathname;
  if (req.method === "GET" && path === "/api/mode")
    return json({
      mock: false,
      serverPending: !configured(env),
      runtime: "workers-free-test",
    });
  const login = path === "/api/login",
    logout = path === "/api/logout",
    projects = path === "/api/projects";
  if (!(login || logout || projects))
    return fail(404, "테스트 배포에서 제공하지 않는 기능입니다.");
  if (req.method !== (projects ? "GET" : "POST"))
    return fail(405, "요청 방식을 확인하세요.");
  if (
    req.method === "POST" &&
    req.headers.get("origin") !== new URL(req.url).origin
  )
    return fail(403, "요청 출처를 확인하세요.");
  const jar = cookies(req);
  if (projects && !jar[accessName] && !jar[refreshName])
    return fail(401, "로그인이 필요합니다.");
  if (!configured(env))
    return fail(503, "Supabase 테스트 환경 변수 등록이 필요합니다.");
  if (login) {
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      return fail(415, "JSON 요청이 필요합니다.");
    const { email, password } = await req.json().catch(() => ({}));
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email ||
      !password ||
      email.length > 320 ||
      password.length > 1024
    )
      return fail(400, "계정 정보를 확인하세요.");
    const result = await grant(env, "password", { email, password });
    return result.error ?? putCookies(json({ ok: true }), result.session);
  }
  if (logout) {
    if (jar[accessName]) {
      const r = await upstream(
        env,
        "/auth/v1/logout?scope=local",
        "POST",
        {},
        jar[accessName],
      );
      if (!r.ok && r.status !== 401)
        return fail(502, "로그아웃을 다시 시도하세요.");
    }
    return putCookies(json({ ok: true }));
  }
  let token = jar[accessName],
    renewed;
  let identity = token
    ? await upstream(env, "/auth/v1/user", "GET", undefined, token)
    : null;
  if (!identity || identity.status === 401 || identity.status === 403) {
    if (!jar[refreshName]) return putCookies(fail(401, "로그인이 필요합니다."));
    const result = await grant(env, "refresh_token", {
      refresh_token: jar[refreshName],
    });
    if (result.error) return result.error;
    renewed = result.session;
    token = renewed.access_token;
  } else if (!identity.ok) return fail(502, "계정 확인을 다시 시도하세요.");
  else if ((await identity.json()).id !== env.OWNER_USER_ID)
    return fail(403, "이 계정에는 접근 권한이 없습니다.");
  const r = await upstream(env, "/rest/v1/rpc/project_list", "POST", {}, token);
  const response = r.ok
    ? json(await r.json())
    : fail(502, "프로젝트 조회 실패. RPC와 소유자 정책을 확인하세요.");
  return renewed ? putCookies(response, renewed) : response;
}
const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GPT to search · Workers 테스트</title><style>body{font:17px/1.6 system-ui;color:#1d2430;background:#f7f8fa;max-width:38rem;margin:8vh auto;padding:1rem}main{background:white;border:1px solid #dde1e7;border-radius:14px;padding:2rem}label,input{display:block}input,button{font:inherit;padding:.55rem;margin:.25rem 0 1rem;box-sizing:border-box}input{width:100%}button{cursor:pointer}p{color:#48515d}</style><main><h1>GPT to search</h1><p>Workers 테스트 · 프로젝트 조회</p><p id="status" role="status"></p><form hidden><label>이메일<input name="email" type="email" autocomplete="username" required></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" required></label><button>로그인</button></form><section hidden><h2>내 프로젝트</h2><ul></ul><button>로그아웃</button></section></main><script type="module" src="/client.js"></script></html>`;
const client = `const form=document.querySelector("form"),section=document.querySelector("section"),status=document.querySelector("#status");async function call(path,data){const r=await fetch("/api/"+path,data?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}:{});return [r.status,await r.json()]}async function load(){const [,mode]=await call("mode");if(mode.serverPending){status.textContent="Supabase 환경 변수 등록 대기 중";return}const [code,rows]=await call("projects");form.hidden=code!==401;section.hidden=code!==200;status.textContent=code===200?(rows.length+"개 프로젝트"):rows.error.message;if(code===200)document.querySelector("ul").replaceChildren(...rows.map(p=>{const li=document.createElement("li");li.textContent=p.name;return li}))}form.onsubmit=async(e)=>{e.preventDefault();const [code,data]=await call("login",Object.fromEntries(new FormData(form)));form.password.value="";if(code===200)await load();else status.textContent=data.error.message};section.querySelector("button").onclick=async()=>{const [code,data]=await call("logout",{});if(code===200)await load();else status.textContent=data.error.message};load().catch(()=>status.textContent="서버 연결을 확인하세요.");`;
export async function tick(env) {
  // Let the existing lease, budget and analysis service own all state transitions.
  if (
    !env.UPDATE_SERVER_ORIGIN ||
    !env.UPDATE_PROJECT_ID ||
    !env.WORKER_OWNER_EMAIL ||
    !env.WORKER_OWNER_PASSWORD
  )
    return "unconfigured";
  const u = new URL(env.UPDATE_SERVER_ORIGIN);
  if (
    u.origin !== env.UPDATE_SERVER_ORIGIN ||
    u.protocol !== "https:" ||
    !/^[-a-f0-9]{36}$/i.test(env.UPDATE_PROJECT_ID)
  )
    throw Error("update configuration");
  const post = (path, body, cookie) =>
    fetch(u.origin + "/api/" + path, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(120000),
      headers: {
        origin: u.origin,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  const auth = await post("login", {
    email: env.WORKER_OWNER_EMAIL,
    password: env.WORKER_OWNER_PASSWORD,
  });
  if (!auth.ok) throw Error("update authentication");
  const jar = auth.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => /^sb-[a-z0-9-]+-auth-token(?:\.\d+)?=/.test(c))
    .join("; ");
  if (!jar) throw Error("update session");
  try {
    const r = await post(
      "projects/" + env.UPDATE_PROJECT_ID + "/updates",
      { manual: false },
      jar,
    );
    if (!r.ok) throw Error("update request");
    return (await r.json()).processed ? "processed" : "idle";
  } finally {
    await post("logout", {}, jar);
  }
}
export default {
  async fetch(req, env) {
    const p = new URL(req.url).pathname;
    if (req.method === "GET" && (p === "/" || p === "/client.js"))
      return new Response(p === "/" ? page : client, {
        headers: {
          ...headers,
          "Content-Type":
            p === "/" ? "text/html; charset=utf-8" : "application/javascript",
          "Content-Security-Policy":
            "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'",
        },
      });
    try {
      return await api(req, env);
    } catch {
      return fail(502, "연결 요청을 다시 시도하세요.");
    }
  },
  async scheduled(event, env) {
    const result = await tick(env);
    console.log(
      JSON.stringify({
        event: "research-update",
        result,
        scheduledTime: event.scheduledTime,
      }),
    );
  },
};
