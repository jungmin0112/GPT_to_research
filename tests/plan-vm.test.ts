import { test, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
test("전용 VM으로 가져온 플랜의 호스트 ID 보존, 재시도, 소유자 검사", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vm-vault-"));
  const owner = crypto.randomUUID(),
    url = "https://test.invalid",
    binding = createHash("sha256").update([url, owner].join("|")).digest("hex");
  const call = (cmd: string, input = "") =>
    spawnSync(
      process.execPath,
      ["--conditions=react-server", "scripts/plan-vm.mjs", cmd],
      {
        input,
        encoding: "utf8",
        env: {
          ...process.env,
          OWNER_USER_ID: owner,
          NEXT_PUBLIC_SUPABASE_URL: url,
          LOCALAPPDATA: dir,
        },
      },
    );
  const account = {
    client: "fixture-client",
    sub: "fixture-sub",
    label: "테스트",
    tokens: {
      access: "access-fixture",
      refresh: "refresh-fixture",
      scope: "fixture",
      expires: 10,
    },
  };
  const packet = { binding, host: "local-fixture", account };
  try {
    expect(call("prepare").status).toBe(0);
    const file = join(dir, "GPT-to-search", binding, "plan.account"),
      original = await readFile(file, "utf8");
    expect(
      call("receive", JSON.stringify({ ...packet, binding: "other" })).status,
    ).toBe(1);
    expect(await readFile(file, "utf8")).toBe(original);
    const first = call("receive", JSON.stringify(packet));
    expect(first.status).toBe(0);
    expect(first.stdout + first.stderr).not.toContain("refresh-fixture");
    const imported = await readFile(file, "utf8");
    expect(call("receive", JSON.stringify(packet)).status).toBe(0);
    expect(await readFile(file, "utf8")).toBe(imported);
    if (process.platform !== "win32")
      expect(JSON.parse(imported)).toMatchObject({
        host: JSON.parse(original).host,
        active: "fixture-client",
      });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
