import { test, expect, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { mockRpc as rpc } from "../src/server/database/mock";
test("5단계 분기, 원문별 대화 분리, 선택 전달의 중복 방지", async () => {
  vi.stubEnv("MOCK_DATA_DIR", await mkdtemp(join(tmpdir(), "explore-")));
  try {
    const target = crypto.randomUUID(),
      main = await rpc(
        "create_project",
        { request_id: target, project_name: "연구", project_purpose: "" },
        true,
      );
    let parent = main;
    for (let i = 0; i < 5; i++) {
      const id = crypto.randomUUID();
      expect(
        await rpc(
          "open_exploration",
          {
            target,
            parent,
            material: null,
            label: "분기 " + i,
            mini: false,
            request_id: id,
          },
          true,
        ),
      ).toBe(id);
      parent = id;
    }
    const minis: string[] = [];
    for (const body of ["원문 A", "원문 B"]) {
      const material = await rpc(
        "save_material",
        {
          target,
          source_kind: "text",
          source_title: body,
          source_origin: "직접",
          source_body: body,
          source_state: "ready",
          source_note: "",
          pdf_hash: null,
        },
        true,
      );
      minis.push(
        (await rpc(
          "open_exploration",
          {
            target,
            parent: null,
            material,
            label: "",
            mini: true,
            request_id: crypto.randomUUID(),
          },
          true,
        )) as string,
      );
    }
    const selected: string[] = [];
    for (const q of ["선택", "제외"]) {
      const turn = crypto.randomUUID(),
        attempt = crypto.randomUUID();
      await rpc(
        "begin_turn",
        { target: minis[0], turn, attempt, body: q, search: "off" },
        true,
      );
      await rpc(
        "finish_turn",
        { attempt, outcome: "completed", body: q + " 답", details: {} },
        true,
      );
      selected.push(turn);
    }
    expect(await rpc("chat_history", { target: minis[1] }, false)).toEqual([]);
    const args = { target, mini_id: minis[0], selected: selected.slice(0, 1) };
    expect(await rpc("forward_reading", args, true)).toBe(1);
    expect(await rpc("forward_reading", args, true)).toBe(0);
    expect(await rpc("chat_history", { target: main }, false)).toMatchObject([
      { question: "선택", answer: "선택 답" },
    ]);
    expect(
      await rpc("related_records", { target: parent, question: "선택" }, false),
    ).toEqual([]);
    await rpc(
      "context_settings",
      { target: parent, level: 1, external: false },
      true,
    );
    expect(
      await rpc("related_records", { target: parent, question: "선택" }, false),
    ).toHaveLength(1);
  } finally {
    vi.unstubAllEnvs();
  }
});
