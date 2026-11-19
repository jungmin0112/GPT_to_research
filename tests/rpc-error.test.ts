import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    rpc,
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
  }),
}));
import { backend } from "../src/server/database/backend";
test("자료 RPC 오류에서 DB 코드만 반환하고 원문과 인수는 숨긴다", async () => {
  vi.stubEnv("APP_MOCK", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture");
  vi.stubEnv("OWNER_USER_ID", "owner");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const call = await backend();
    for (const [name, code, status] of [
      ["search_materials", "PGRST202", 503],
      ["claim_material", "42501", 403],
    ] as const) {
      rpc.mockResolvedValueOnce({
        error: { code, message: "private fixture", details: "private fixture" },
      });
      const error = await call(
        name,
        { target: "private fixture" },
        false,
      ).catch((e) => e);
      expect(error).toMatchObject({ status });
      expect(error.message).toContain(code);
      expect(error.message).not.toContain("private fixture");
      expect(log).toHaveBeenLastCalledWith("Supabase RPC", name, code);
    }
  } finally {
    log.mockRestore();
    vi.unstubAllEnvs();
  }
});
