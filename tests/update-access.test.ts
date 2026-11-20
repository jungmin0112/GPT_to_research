import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { withVault, type Tokens } from "@/server/integrations/chatgpt/vault";
import { updateKnowledge } from "@/modules/updates/server";

const target = crypto.randomUUID();
let directory: string;
const fetch = vi.fn();

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "gts-update-access-"));
  vi.stubEnv("LOCALAPPDATA", directory);
  vi.stubEnv("OWNER_USER_ID", "fixture");
  vi.stubEnv("APP_MOCK", "0");
  vi.stubGlobal("fetch", fetch.mockReset());
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

async function connect(tokens: Tokens) {
  await withVault((v) => {
    v.active = "fixture";
    v.accounts = [
      { client: "fixture", sub: "fixture", label: "fixture", tokens },
    ];
  });
}

test.each([true, false])(
  "미연결이면 선점과 실패 기록을 모두 생략한다 (manual=%s)",
  async (manual) => {
    const rpc = vi.fn();
    await expect(updateKnowledge(rpc, target, manual)).rejects.toMatchObject({
      status: 401,
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  },
);

test("만료된 플랜의 갱신 거절은 선점 전에 처리한다", async () => {
  await connect({
    access: "expired",
    refresh: "fixture",
    expires: 0,
    scope: "chatgpt.tokens.use.direct",
  });
  fetch.mockResolvedValue(
    Response.json({ error: "invalid_grant" }, { status: 400 }),
  );
  const rpc = vi.fn();
  await expect(updateKnowledge(rpc, target, false)).rejects.toMatchObject({
    status: 401,
  });
  expect(rpc).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe(
    "https://auth.openai.com/api/accounts/oauth/token",
  );
});

test("활성 플랜의 빈 대기열은 추론 없이 종료한다", async () => {
  await connect({
    access: "fixture",
    expires: Date.now() + 600000,
    scope: "chatgpt.tokens.use.direct",
  });
  const rpc = vi.fn().mockResolvedValue([]);
  await expect(updateKnowledge(rpc, target, false)).resolves.toBe(0);
  expect(rpc).toHaveBeenCalledExactlyOnceWith(
    "claim_knowledge",
    { target, job: expect.any(String), manual: false },
    false,
  );
  expect(fetch).not.toHaveBeenCalled();
});

test("개발 mock은 플랜 없이 근거를 처리한다", async () => {
  vi.stubEnv("APP_MOCK", "1");
  const rpc = vi
    .fn()
    .mockResolvedValueOnce([
      { title: "관측", body: "온도 증가", kind: "material" },
    ])
    .mockResolvedValueOnce({ nodes: [] })
    .mockResolvedValueOnce("created")
    .mockResolvedValueOnce([]);
  await expect(updateKnowledge(rpc, target, true)).resolves.toBe(1);
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    "claim_knowledge",
    "knowledge_state",
    "commit_knowledge",
    "claim_knowledge",
  ]);
  expect(fetch).not.toHaveBeenCalled();
});
