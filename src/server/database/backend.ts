import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export class Problem extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function mockMode() {
  return process.env.NODE_ENV !== "production" && process.env.APP_MOCK === "1";
}
export async function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !process.env.OWNER_USER_ID)
    throw new Problem(503, "Supabase 연결 설정이 필요합니다.");
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (changes) =>
        changes.forEach(({ name, value, options }) =>
          jar.set(name, value, options),
        ),
    },
  });
}
export async function login(email: string, password: string) {
  if (mockMode()) {
    const token = await (await import("./mock")).mockLogin();
    (await cookies()).set("research_demo", token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 86400,
    });
    return;
  }
  const client = await supabase();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Problem(401, "이메일과 비밀번호를 확인해 주세요.");
  if (data.user.id !== process.env.OWNER_USER_ID) {
    await client.auth.signOut({ scope: "local" });
    throw new Problem(403, "허용된 계정으로 로그인해 주세요.");
  }
}
export async function logout() {
  if (mockMode()) {
    const jar = await cookies();
    await (
      await import("./mock")
    ).mockLogout(jar.get("research_demo")?.value || "");
    jar.delete("research_demo");
  } else if ((await (await supabase()).auth.signOut({ scope: "local" })).error)
    throw new Problem(503, "로그아웃을 다시 시도해 주세요.");
}
export async function backend() {
  if (mockMode()) {
    const mock = await import("./mock");
    if (
      !(await mock.mockAuthenticated(
        (await cookies()).get("research_demo")?.value || "",
      ))
    )
      throw new Problem(401, "로그인이 필요합니다.");
    return mock.mockRpc;
  }
  const client = await supabase();
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Problem(401, "로그인이 필요합니다.");
  if (data.user.id !== process.env.OWNER_USER_ID)
    throw new Problem(403, "허용되지 않은 계정입니다.");
  return async (
    name: string,
    args: Record<string, unknown>,
    scalar: boolean,
  ) => {
    void scalar;
    const { data, error } = await client.rpc(name, args);
    if (error) {
      const code = /^(?:[A-Z0-9]{5}|PGRST[0-9]{3})$/.test(error.code)
        ? error.code
        : "UNKNOWN";
      console.error("Supabase RPC", name, code);
      const reason = ["42883", "42P01", "PGRST202", "PGRST205"].includes(code)
        ? "해당 DB 객체를 찾을 수 없습니다. 미적용 마이그레이션과 PostgREST 스키마 캐시를 확인하세요."
        : code === "42501"
          ? "DB 실행 권한과 소유자 정책을 확인하세요."
          : "데이터 저장소 요청을 완료하지 못했습니다.";
      throw new Problem(
        code === "42501" ? 403 : 503,
        reason + " (" + name + " · " + code + ")",
      );
    }
    return data;
  };
}

export type Rpc = Awaited<ReturnType<typeof backend>>;
