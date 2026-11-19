// Anonymous acceptance check for a configured private production server.
const configured = process.argv[2];
if (!configured) throw Error("검사할 연구 서버의 HTTPS 원점을 지정하세요.");
const base = new URL(configured);
if (base.protocol !== "https:" || configured.replace(/\/$/, "") !== base.origin)
  throw Error("HTTPS 원점만 허용합니다.");
async function get(path) {
  return fetch(new URL(path,base), {redirect:"error",signal:AbortSignal.timeout(15000)});
}
try {
  const root=await get("/");
  if(!root.ok || !(await root.text()).includes("GPT to search")) throw Error("앱 첫 화면");
  const mode=await get("/api/mode");
  const state=await mode.json();
  if(!mode.ok || state.mock!==false || state.serverPending) throw Error("운영 모드");
  const privateData=await get("/api/projects");
  if(privateData.status!==401) throw Error("Supabase 소유자 인증 경계 (HTTP "+privateData.status+")");
  console.log("HTTPS 앱, 운영 모드 및 익명 프로젝트 접근 차단 확인");
} catch(error) {
  console.error("연구 서버 확인 실패 —", error.message);
  process.exitCode=1;
}
