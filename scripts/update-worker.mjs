// Run beside the trusted local app. The owner session only lives in this process.
import { setTimeout as delay } from "node:timers/promises";
const base = new URL(process.env.WORKER_LOCAL_URL || "http://127.0.0.1:3000");
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
  base.protocol !== "http:"
)
  throw Error("루프백 앱 주소가 필요합니다.");
const email = process.env.WORKER_OWNER_EMAIL,
  password = process.env.WORKER_OWNER_PASSWORD;
if (!email || !password)
  throw Error("작업자 전용 환경에 소유자 로그인 설정이 필요합니다.");
const jar = new Map();
async function call(path, body) {
  const r = await fetch(new URL("/api/" + path, base), {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      origin: base.origin,
      cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
    },
    redirect: "error",
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const entry of r.headers.getSetCookie()) {
    const first = entry.split(";")[0],
      i = first.indexOf("=");
    jar.set(first.slice(0, i), first.slice(i + 1));
  }
  if (!r.ok) throw Object.assign(Error("요청 실패"), { status: r.status });
  return r.json();
}
async function check() {
  let projects;
  try {
    projects = await call("projects");
  } catch (e) {
    if (e.status !== 401) throw e;
    await call("login", { email, password });
    projects = await call("projects");
  }
  for (const p of projects) {
    try {
      await call("projects/" + p.id + "/updates", { manual: false });
    } catch (e) {
      console.error("갱신 실패", e.status ?? "network");
    }
  }
}
do {
  const start = Date.now();
  try {
    await check();
  } catch (e) {
    console.error("작업자 연결 오류", e.status ?? "network");
  }
  if (process.argv.includes("--once")) break;
  await delay(Math.max(0, 60000 - (Date.now() - start)));
} while (true);
