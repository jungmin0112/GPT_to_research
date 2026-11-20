import test from "node:test";
import assert from "node:assert/strict";
import edge, { tick } from "./worker.mjs";
import { api as gateway } from "../sites/worker.mjs";
const origin = "https://edge.workers.dev";
const env = {
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-fixture",
  OWNER_USER_ID: "test-owner",
};
const incoming = (path, options) => new Request(origin + path, options);
test("로그인, 소유자 검증, Sites 쿠키 전달, 토큰 갱신과 프로젝트 RLS 요청", async (t) => {
  let allow = true,
    lastGrant;
  const session = {
    user: { id: "test-owner" },
    access_token: "fixture-access",
    refresh_token: "fixture-refresh",
    expires_in: 3600,
  };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const dest = new URL(url);
    if (dest.origin === origin)
      return edge.fetch(new Request(url, { ...init, duplex: "half" }), env);
    assert.equal(dest.origin, env.SUPABASE_URL);
    assert.equal(init.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
    if (dest.pathname === "/auth/v1/token") {
      lastGrant = dest.searchParams.get("grant_type");
      return Response.json({
        ...session,
        user: { id: allow ? env.OWNER_USER_ID : "another-owner" },
      });
    }
    if (dest.pathname === "/auth/v1/user") return Response.json(session.user);
    assert.equal(dest.pathname, "/rest/v1/rpc/project_list");
    assert.equal(init.headers.Authorization, "Bearer fixture-access");
    return Response.json([{ name: "테스트 프로젝트" }]);
  });
  const site = "https://private.example";
  const forward = (path, options) =>
    gateway(new Request(site + path, options), {
      RESEARCH_SERVER_ORIGIN: origin,
    });
  const options = {
    method: "POST",
    headers: { origin: site, "content-type": "application/json" },
    body: JSON.stringify({
      email: "test@example.invalid",
      password: "fixture",
    }),
  };
  const logged = await forward("/api/login", options);
  assert.equal(logged.status, 200);
  assert.equal(lastGrant, "password");
  const pair = logged.headers.getSetCookie().map((s) => s.split(";")[0]);
  assert.equal(pair.length, 2);
  const list = await forward("/api/projects", {
    headers: { cookie: pair.join("; ") },
  });
  assert.deepEqual(await list.json(), [{ name: "테스트 프로젝트" }]);
  const renewed = await forward("/api/projects", {
    headers: { cookie: pair[1] },
  });
  assert.equal(renewed.status, 200);
  assert.equal(lastGrant, "refresh_token");
  allow = false;
  assert.equal((await forward("/api/login", options)).status, 403);
});
test("익명 401 및 요청 출처", async () => {
  assert.equal((await edge.fetch(incoming("/api/projects"), {})).status, 401);
  assert.equal(
    (
      await edge.fetch(
        incoming("/api/login", {
          method: "POST",
          headers: { origin: "https://else.invalid" },
        }),
        env,
      )
    ).status,
    403,
  );
});
test("예약은 미설정 시 외부 호출 0, 설정 시 수동 갱신 우회 없이 한 프로젝트 호출", async (t) => {
  let calls = 0;
  const fake = t.mock.method(globalThis, "fetch", async (url, init) => {
    calls++;
    if (url.endsWith("/login"))
      return new Response("{}", {
        headers: { "set-cookie": "sb-abc-auth-token=fixture; Secure" },
      });
    assert.equal(init.headers.cookie, "sb-abc-auth-token=fixture");
    if (url.endsWith("/updates")) {
      assert.deepEqual(JSON.parse(init.body), { manual: false });
      return Response.json({ processed: 1 });
    }
    assert.ok(url.endsWith("/logout"));
    return Response.json({ ok: true });
  });
  assert.equal(await tick({}), "unconfigured");
  assert.equal(calls, 0);
  assert.equal(
    await tick({
      UPDATE_SERVER_ORIGIN: "https://host.example",
      UPDATE_PROJECT_ID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      WORKER_OWNER_EMAIL: "fixture",
      WORKER_OWNER_PASSWORD: "fixture",
    }),
    "processed",
  );
  assert.equal(fake.mock.callCount(), 3);
});
