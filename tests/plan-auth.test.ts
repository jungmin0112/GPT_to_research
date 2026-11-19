import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { SignJWT, generateKeyPair, exportJWK, type JWK } from "jose";
vi.mock("server-only", () => ({}));
vi.mock("../src/server/database/backend", () => ({
  Problem: class Problem extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
let publicKey: JWK;
vi.mock("jose", async (original) => {
  const actual = await original<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: () => async () => actual.importJWK(publicKey, "RS256"),
  };
});
import {
  startLogin,
  access,
  disconnect,
  status,
  issuer,
  resource,
} from "../src/server/integrations/chatgpt/oauth";
import { withVault } from "../src/server/integrations/chatgpt/vault";
let directory: string;
const grant = "openid resource.invoke chatgpt.tokens.use.direct offline_access";
const ret = "http://127.0.0.1:3000/?session=fixture";
const localFetch = globalThis.fetch;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "gts-auth-"));
  vi.stubEnv("LOCALAPPDATA", directory);
  vi.stubEnv("OWNER_USER_ID", "fixture");
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
function callback(url: URL, params: Record<string, string>) {
  const target = new URL(url.searchParams.get("redirect_uri")!);
  target.search = new URLSearchParams({
    state: url.searchParams.get("state")!,
    ...params,
  }).toString();
  return localFetch(target, { redirect: "manual" });
}
test.each(["success", "decline", "nonce", "scope"])(
  "PKCE loopback callback: %s",
  async (scenario) => {
    const url = new URL(await startLogin(undefined, ret));
    expect(url.origin + url.pathname).toBe(issuer + "/api/accounts/authorize");
    expect(url.searchParams.get("client_id")).toBe("dynamic_agent_client");
    expect(url.searchParams.get("resource")).toBe(resource);
    expect(
      (await callback(url, { state: "wrong", code: "fixture" })).status,
    ).toBe(400);
    const pair = await generateKeyPair("RS256");
    publicKey = await exportJWK(pair.publicKey);
    const id = await new SignJWT({
      nonce: scenario === "nonce" ? "wrong" : url.searchParams.get("nonce"),
      email: "test@example.test",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("test")
      .setIssuer(issuer)
      .setAudience("issued")
      .setExpirationTime("1h")
      .sign(pair.privateKey);
    const remote = vi.fn(async (endpoint: string, init: RequestInit) => {
      expect(endpoint).toBe(issuer + "/api/accounts/oauth/token");
      const args = init.body as URLSearchParams;
      expect(args.get("client_id")).toBe("issued");
      expect(args.get("redirect_uri")).toBe(
        url.searchParams.get("redirect_uri"),
      );
      expect(
        createHash("sha256")
          .update(args.get("code_verifier")!)
          .digest("base64url"),
      ).toBe(url.searchParams.get("code_challenge"));
      return Response.json({
        token_type: "Bearer",
        scope: scenario === "scope" ? "openid" : grant,
        id_token: id,
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
      });
    });
    vi.stubGlobal("fetch", remote);
    const res = await callback(
      url,
      scenario === "decline"
        ? { error: "access_denied" }
        : { client_id: "issued", code: "fixture" },
    );
    if (scenario === "decline" || scenario === "nonce") {
      expect(res.status).toBe(400);
      expect((await status()).active).toBeUndefined();
      if (scenario === "decline") expect(remote).not.toHaveBeenCalled();
      return;
    }
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(ret);
    const info = await status();
    expect(info.accounts[0].connected).toBe(scenario === "success");
    expect(JSON.stringify(info)).not.toContain("refresh");
    if (scenario === "scope") await expect(access()).rejects.toThrow();
    else expect((await access()).token).toBe("access");
    const again = new URL(await startLogin("issued", ret));
    expect(again.searchParams.get("ext_agent_host_id")).toBe(
      url.searchParams.get("ext_agent_host_id"),
    );
    expect(again.searchParams.get("client_id")).toBe("issued");
    expect(
      (await callback(again, { code: "fixture", client_id: "different" }))
        .status,
    ).toBe(400);
  },
);
test("동시 갱신 한 번, 회전된 토큰 폐기, 계정 등록 유지", async () => {
  await withVault((v) => {
    v.active = "issued";
    v.accounts.push({
      client: "issued",
      sub: "user",
      label: "user",
      tokens: { access: "old", refresh: "r1", scope: grant, expires: 0 },
    });
  });
  let refreshes = 0;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/token")) {
      refreshes++;
      expect((init.body as URLSearchParams).get("refresh_token")).toBe("r1");
      return Response.json({
        token_type: "Bearer",
        access_token: "next",
        refresh_token: "r2",
        expires_in: 3600,
      });
    }
    if (url.endsWith("openid-configuration"))
      return Response.json({ revocation_endpoint: issuer + "/revoke" });
    expect((init.body as URLSearchParams).get("token")).toBe("r2");
    return new Response("");
  });
  expect((await Promise.all([access(), access()])).map((a) => a.token)).toEqual(
    ["next", "next"],
  );
  expect(refreshes).toBe(1);
  expect((await disconnect()).confirmed).toBe(true);
  expect((await status()).accounts[0].connected).toBe(false);
  await expect(access()).rejects.toThrow();
});
