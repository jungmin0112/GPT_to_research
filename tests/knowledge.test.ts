import { test, expect, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { mockRpc as rpc } from "../src/server/database/mock";
import type { KnowledgeState } from "../src/modules/knowledge";
test("증분 갱신 선점, 중복 및 다른 프로젝트 격리, 충돌 승인 전 원본 보존", async () => {
  vi.stubEnv("MOCK_DATA_DIR", await mkdtemp(join(tmpdir(), "knowledge-")));
  const target = crypto.randomUUID();
  const other = crypto.randomUUID();
  for (const id of [target, other])
    await rpc(
      "create_project",
      { request_id: id, project_name: "연구", project_purpose: "" },
      true,
    );
  const add = async (body: string) =>
    rpc(
      "save_material",
      {
        target,
        source_kind: "text",
        source_title: "지표",
        source_origin: "관측 기록",
        source_body: body,
        source_state: "ready",
        source_note: "",
        pdf_hash: null,
      },
      true,
    );
  const claim = (job: string, manual = true) =>
    rpc("claim_knowledge", { target, job, manual }, false);
  const apply = (job: string, quote: string) =>
    rpc(
      "commit_knowledge",
      {
        target,
        job,
        decision: {
          action: "new",
          title: "지표",
          topic: "관측",
          body: quote,
          quote,
          reason: "직접 관측",
        },
      },
      true,
    );
  const state = async () =>
    (await rpc("knowledge_state", { target }, true)) as KnowledgeState;
  await add("증가");
  await add("증가");
  expect(await claim(crypto.randomUUID(), false)).toEqual([]);
  const job = crypto.randomUUID();
  expect(await claim(job)).toHaveLength(1);
  expect(await claim(crypto.randomUUID())).toEqual([]);
  expect(await apply(job, "증가")).toBe("created");
  expect(await apply(job, "증가")).toBe("stale");
  expect(await claim(crypto.randomUUID())).toEqual([]);
  await add("감소");
  const next = crypto.randomUUID();
  await claim(next);
  expect(await apply(next, "감소")).toBe("review");
  const before = await state();
  expect(before.nodes[0].body).toBe("증가");
  expect(
    ((await rpc("knowledge_state", { target: other }, true)) as KnowledgeState)
      .nodes,
  ).toHaveLength(0);
  const item = before.changes.find((c) => c.state === "review")!.id;
  expect(
    await rpc(
      "review_knowledge",
      { target, item, expected: 0, choice: "accept", edited: "변경" },
      true,
    ),
  ).toBe("stale");
  expect(
    await rpc(
      "review_knowledge",
      { target, item, expected: 1, choice: "accept", edited: "감소" },
      true,
    ),
  ).toBe("applied");
  expect((await state()).nodes[0].body).toBe("감소");
  expect((await state()).changes[0].accepted).toBe("증가");
  vi.unstubAllEnvs();
});
