import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { withVault, type Account, type Tokens } from "./vault";
import { Problem } from "@/server/database/backend";

export const issuer = "https://auth.openai.com",
  resource = "https://api.openai.com/v1";
const permission = "chatgpt.tokens.use.direct",
  initial = "dynamic_agent_client";
const jwks = createRemoteJWKSet(new URL(issuer + "/.well-known/jwks.json"));
const random = () => randomBytes(32).toString("base64url");
const hasGrant = (scope: string) => scope.split(/\s+/).includes(permission);
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().optional(),
  expires_in: z.number().positive(),
  token_type: z.string().regex(/^Bearer$/i),
  scope: z.string().optional(),
});
function tokens(raw: z.infer<typeof tokenSchema>, prior?: Tokens): Tokens {
  return {
    access: raw.access_token,
    refresh: raw.refresh_token ?? prior?.refresh,
    id: prior?.id ?? raw.id_token,
    expires: Date.now() + raw.expires_in * 1000,
    scope: raw.scope ?? prior?.scope ?? "",
  };
}
async function form(url: string, params: Record<string, string>) {
  return fetch(url, {
    method: "POST",
    body: new URLSearchParams(params),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
}
const exchange = (params: Record<string, string>) =>
  form(issuer + "/api/accounts/oauth/token", { ...params, resource });
export function status() {
  return withVault((v) => ({
    active: v.active,
    accounts: v.accounts.map((a) => ({
      client: a.client,
      label: a.label,
      connected: !!a.tokens && hasGrant(a.tokens.scope),
      welcome: !!a.tokens && hasGrant(a.tokens.scope) && !a.welcomed,
      model: a.model,
    })),
  }));
}
export async function startLogin(
  client: string | undefined,
  returnUrl: string,
) {
  const state = random(),
    nonce = random(),
    verifier = random();
  const { account, host } = await withVault((v) => {
    const account = v.accounts.find((a) => a.client === client);
    if (client && !account)
      throw new Problem(404, "등록한 계정을 찾을 수 없습니다.");
    v.pending = state;
    return { account, host: v.host };
  });
  const server = createServer();
  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ok);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("loopback");
  const authority = "127.0.0.1:" + address.port;
  const redirect = "http://" + authority + "/auth/callback";
  const timer = setTimeout(() => server.close(), 300000);
  timer.unref();
  let consumed = false;
  server.on("request", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    try {
      const url = new URL(req.url || "/", redirect),
        p = url.searchParams;
      if (
        req.method !== "GET" ||
        req.headers.host !== authority ||
        url.pathname !== "/auth/callback" ||
        p.get("state") !== state ||
        consumed
      ) {
        res.writeHead(400);
        res.end("유효하지 않은 로그인 요청입니다.");
        return;
      }
      consumed = true;
      clearTimeout(timer);
      server.close();
      await withVault(async (v) => {
        if (v.pending !== state)
          throw new Problem(400, "새 로그인 시도가 시작되었습니다.");
        if (p.has("error"))
          throw new Problem(
            403,
            "ChatGPT 승인이 취소되었습니다. 앱으로 돌아가 다시 연결할 수 있습니다.",
          );
        const issued = p.get("client_id") ?? account?.client,
          code = p.get("code");
        if (
          !issued ||
          issued === initial ||
          !code ||
          (account && issued !== account.client)
        )
          throw new Problem(400, "등록 정보를 확인할 수 없습니다.");
        const response = await exchange({
          grant_type: "authorization_code",
          client_id: issued,
          code,
          code_verifier: verifier,
          redirect_uri: redirect,
        });
        if (!response.ok)
          throw new Problem(
            401,
            "승인 코드 교환에 실패했습니다. 앱에서 다시 연결하세요.",
          );
        const t = tokenSchema.parse(await response.json());
        if (!t.id_token) throw Error("identity missing");
        const { payload } = await jwtVerify(t.id_token, jwks, {
          issuer,
          audience: issued,
          algorithms: ["RS256"],
          requiredClaims: ["exp", "sub", "nonce"],
        });
        const stored = v.accounts.find((a) => a.client === issued);
        if (
          !payload.sub ||
          payload.nonce !== nonce ||
          (stored && stored.sub !== payload.sub)
        )
          throw Error("identity mismatch");
        const entry: Account = stored ?? {
          client: issued,
          sub: payload.sub,
          label: typeof payload.email === "string" ? payload.email : "ChatGPT",
        };
        entry.tokens = tokens(t);
        if (!stored) v.accounts.push(entry);
        v.active = issued;
        delete v.pending;
      });
      res.writeHead(303, { Location: returnUrl });
      res.end();
    } catch (e) {
      res.writeHead(400);
      res.end(
        e instanceof Problem
          ? e.message
          : "ChatGPT 연결 검증에 실패했습니다. 앱으로 돌아가 다시 시도하세요.",
      );
    }
  });
  const url = new URL(issuer + "/api/accounts/authorize");
  url.search = new URLSearchParams({
    client_id: account?.client ?? initial,
    ext_agent_host_id: host,
    response_type: "code",
    redirect_uri: redirect,
    scope: "openid profile email offline_access resource.invoke " + permission,
    resource,
    state,
    nonce,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    ...(account
      ? {
          ...(account.tokens?.id ? { id_token_hint: account.tokens.id } : {}),
          ...(account.tokens && !hasGrant(account.tokens.scope)
            ? { prompt: "consent" }
            : {}),
        }
      : { agent_name_hint: "GPT to search" }),
  }).toString();
  return url.href;
}
export async function access() {
  const result = await withVault(async (v) => {
    const a = v.accounts.find((a) => a.client === v.active);
    if (!a?.tokens?.access || !hasGrant(a.tokens.scope)) return null;
    if (a.tokens.expires < Date.now() + 60000) {
      if (!a.tokens.refresh) {
        delete a.tokens;
        return null;
      }
      const res = await exchange({
        grant_type: "refresh_token",
        client_id: a.client,
        refresh_token: a.tokens.refresh,
      });
      const body = await res.json();
      if (!res.ok) {
        const code =
          typeof body.error === "string" ? body.error : body.error?.code;
        if (
          [
            "invalid_grant",
            "invalid_refresh_token",
            "token_expired",
            "refresh_token_expired",
            "refresh_token_invalidated",
            "refresh_token_reused",
          ].includes(code)
        ) {
          delete a.tokens;
          return null;
        }
        throw new Problem(
          503,
          "ChatGPT 인증 갱신에 실패했습니다. 잠시 후 다시 시도하세요.",
        );
      }
      a.tokens = tokens(tokenSchema.parse(body), a.tokens);
      if (!hasGrant(a.tokens.scope)) return null;
    }
    return { token: a.tokens.access, client: a.client, model: a.model };
  });
  if (!result)
    throw new Problem(
      401,
      "Continue with ChatGPT에서 계정과 플랜 사용 권한을 확인하세요.",
    );
  return result;
}
export async function models(token: string) {
  const response = await fetch(resource + "/models", {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Problem(
      response.status,
      "ChatGPT 모델 목록을 가져오지 못했습니다 (HTTP " + response.status + ").",
    );
  const data = z
    .object({
      models: z.array(
        z.object({
          slug: z.string(),
          display_name: z.string().optional(),
          visibility: z.string().optional(),
        }),
      ),
    })
    .parse(await response.json());
  return data.models
    .filter((m) => m.visibility === "list")
    .map((m) => ({ id: m.slug, name: m.display_name || m.slug }));
}
export async function disconnect() {
  return withVault(async (v) => {
    const a = v.accounts.find((a) => a.client === v.active);
    let confirmed = false;
    if (a?.tokens?.refresh) {
      try {
        const cfg = await fetch(issuer + "/.well-known/openid-configuration", {
          signal: AbortSignal.timeout(8000),
          redirect: "error",
        }).then((r) => r.json());
        const url = new URL(cfg.revocation_endpoint);
        if (url.origin !== issuer) throw Error("issuer");
        for (let i = 0; i < 2; i++) {
          try {
            const r = await form(url.href, {
              token: a.tokens.refresh,
              token_type_hint: "refresh_token",
              client_id: a.client,
            });
            confirmed = r.status === 200;
            if (confirmed || r.status < 500) break;
          } catch {}
          if (!i) await new Promise((resolve) => setTimeout(resolve, 450));
        }
      } catch {
        /* Clear local credentials even when remote revocation is unavailable. */
      }
    }
    if (a) delete a.tokens;
    delete v.active;
    delete v.pending;
    return { confirmed };
  });
}
