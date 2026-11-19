// Only the selected Supabase project's SSR cookies travel between the two origins.
const sessionKey = /^sb-[a-z0-9-]+-auth-token(?:\.\d+)?$/;
const unavailable = "연구 서버 연결 대기 중입니다. 서버를 연결하면 기존 Supabase 계정으로 로그인할 수 있습니다.";
function error(status, message) {
  return Response.json({ error: { code: status, message } }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function api(request, env) {
  const site = new URL(request.url);
  if (!["GET", "POST"].includes(request.method)) return error(405, "지원하지 않는 요청입니다.");
  if (request.method === "POST" && request.headers.get("origin") !== site.origin) return error(403, "요청 출처를 확인하세요.");
  if (site.pathname === "/api/plan/login") return error(403, "계정 승인은 전용 서버에서 진행하세요.");
  if (!env.RESEARCH_SERVER_ORIGIN) {
    return site.pathname === "/api/mode" ? Response.json({mock:false,serverPending:true},{headers:{"Cache-Control":"no-store"}}) : error(503, unavailable);
  }
  let upstream;
  try {
    upstream = new URL(env.RESEARCH_SERVER_ORIGIN);
    if (upstream.protocol !== "https:" || upstream.origin === site.origin || upstream.origin !== env.RESEARCH_SERVER_ORIGIN.replace(/\/$/,"")) throw Error();
  } catch {return error(503, unavailable);}
  const headers = new Headers();
  for (const k of ["content-type","accept"]) if (request.headers.has(k)) headers.set(k,request.headers.get(k));
  const cookies=(request.headers.get("cookie")||"").split(";").map(c=>c.trim()).filter(c=>sessionKey.test(c.split("=",1)[0]));
  if (cookies.length) headers.set("cookie",cookies.join("; "));
  if(request.method==="POST") headers.set("origin",upstream.origin);
  upstream.pathname=site.pathname;
  upstream.search=site.search;
  try {
    const response = await fetch(upstream,{method:request.method,headers,body:request.method==="POST"?request.body:undefined,redirect:"manual"});
    if(response.status>=300&&response.status<400)return error(502,"연구 서버 주소를 확인하세요.");
    const out=new Headers({"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
    for (const k of ["content-type","content-disposition"]) if(response.headers.has(k))out.set(k,response.headers.get(k));
    for(const cookie of response.headers.getSetCookie()){
      if(sessionKey.test(cookie.split("=",1)[0]))out.append("set-cookie",cookie.replace(/;\s*domain=[^;]*/ig,"")+"; Secure; HttpOnly");
    }
    return new Response(response.body,{headers:out,status:response.status});
  } catch { return error(502,"연구 서버에 연결하지 못했습니다."); }
}
