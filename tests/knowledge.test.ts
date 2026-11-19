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

test("메시지 및 결과물 분기의 근거와 사용자 편집/분류 이력", async () => {
  const target = crypto.randomUUID(),
    parent = await rpc(
      "create_project",
      { request_id: target, project_name: "편집", project_purpose: "" },
      true,
    );
  const turn = crypto.randomUUID(),
    attempt = crypto.randomUUID();
  await rpc(
    "begin_turn",
    { target: parent, turn, attempt, body: "관찰", search: "off" },
    true,
  );
  await rpc(
    "finish_turn",
    { attempt, outcome: "completed", body: "과정 보존", details: {} },
    true,
  );
  const args = {
    target,
    parent,
    label: "기록 출발",
    request_id: crypto.randomUUID(),
    anchor_turn: turn,
    anchor_node: null,
  };
  expect(await rpc("anchored_branch", args, true)).toBe(args.request_id);
  const job = crypto.randomUUID();
  await rpc("claim_knowledge", { target, job, manual: true }, false);
  await rpc(
    "commit_knowledge",
    {
      target,
      job,
      decision: {
        action: "new",
        title: "관찰",
        topic: "기록",
        body: "과정 보존",
        quote: "과정",
        reason: "관찰 근거",
      },
    },
    true,
  );
  const state = async () =>
    (await rpc("knowledge_state", { target }, true)) as KnowledgeState;
  const n = (await state()).nodes[0];
  const child = crypto.randomUUID();
  expect(
    await rpc(
      "anchored_branch",
      { ...args, request_id: child, anchor_turn: null, anchor_node: n.id },
      true,
    ),
  ).toBe(child);
  expect(
    await rpc(
      "edit_knowledge",
      {
        target,
        node: n.id,
        expected: n.revision,
        content: "새 본문",
        category: "재분류",
        separate: null,
        new_title: "",
      },
      true,
    ),
  ).toBe("saved");
  const after = await state();
  expect(after.edits?.[0].previous.body).toBe("과정 보존");
  expect(after.nodes[0].topic).toBe("재분류");
  expect(
    await rpc(
      "edit_knowledge",
      {
        target,
        node: n.id,
        expected: 2,
        content: "사용자가 남긴 기록",
        category: "재분류",
        separate: after.changes[0].id,
        new_title: "분리 결과",
      },
      true,
    ),
  ).toBe("saved");
  expect((await state()).nodes.length).toBe(2);
  expect((await state()).changes[0].original_node).toBe(n.id);
});
