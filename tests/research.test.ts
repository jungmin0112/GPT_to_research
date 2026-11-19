import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/server/database/backend", () => ({
  mockMode: () => false,
  Problem: class Problem extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/server/integrations/chatgpt/oauth", () => ({
  access: async () => ({ token: "oauth-fixture", client: "registration" }),
  models: async () => [{ id: "account-model", name: "model" }],
  resource: "https://api.openai.com/v1",
}));
import { chat } from "../src/modules/sessions/chat-service";
import { mockRpc } from "../src/server/database/mock";
import type { Turn } from "../src/shared/types/conversation";

test("플랜 SSE → DB 저장/재조회, 검색 출처, 스트림 도중 한도 도달", async () => {
  const directory = await mkdtemp(join(tmpdir(), "plan-chat-"));
  vi.stubEnv("MOCK_DATA_DIR", directory);
  vi.stubEnv("OPENAI_API_KEY", "must-never-send");
  vi.stubEnv("OPENAI_BASE_URL", "https://unused.invalid");
  let limited = false;
  const inputs: string[] = [];
  const transport = vi.fn(async (url: string, init: RequestInit) => {
    expect(String(url)).toBe("https://api.openai.com/v1/responses");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer oauth-fixture",
    );
    const payload = JSON.parse(String(init.body));
    inputs.push(JSON.stringify(payload.input));
    expect(Object.keys(payload).sort()).toEqual(
      (payload.tools
        ? [
            "model",
            "store",
            "stream",
            "instructions",
            "input",
            "tools",
            "tool_choice",
            "include",
          ]
        : ["model", "store", "stream", "instructions", "input"]
      ).sort(),
    );
    expect(payload.model).toBe("account-model");
    expect(payload.store).toBe(false);
    expect(payload.stream).toBe(true);
    if (payload.tools) {
      expect(payload.tools).toEqual([{ type: "web_search" }]);
      expect(payload.input).toContainEqual({
        role: "assistant",
        content: "기본 답변",
      });
    }
    const output = payload.tools
      ? [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                annotations: [
                  {
                    type: "url_citation",
                    url: "https://example.org/report",
                    title: "출처",
                    start_index: 0,
                    end_index: 2,
                  },
                ],
              },
            ],
          },
          {
            type: "web_search_call",
            action: {
              type: "search",
              sources: [{ url: "https://example.org/candidate" }],
            },
          },
        ]
      : [];
    const events = [
      {
        type: "response.output_text.delta",
        delta: payload.tools ? "검색 답변" : "기본 답변",
      },
      limited
        ? {
            type: "response.failed",
            response: {
              error: { code: "subscription_sharing_usage_limit_exceeded" },
            },
          }
        : {
            type: "response.completed",
            response: {
              id: "response-fixture",
              model: "account-model",
              output,
            },
          },
    ];
    return new Response(
      events.map((e) => "data: " + JSON.stringify(e) + "\n\n").join(""),
      { headers: { "content-type": "text/event-stream" } },
    );
  });
  vi.stubGlobal("fetch", transport);
  try {
    const project = crypto.randomUUID();
    const target = (await mockRpc(
      "create_project",
      {
        request_id: project,
        project_name: "test",
        project_purpose: "",
      },
      true,
    )) as string;
    async function send(mode: string, reference?: string) {
      return (
        await chat(
          new Request("http://localhost", {
            method: "POST",
            body: JSON.stringify({
              text: "질문",
              client_message_id: crypto.randomUUID(),
              search_mode: mode,
              explicit_ref: reference,
            }),
          }),
          target,
          mockRpc,
        )
      ).text();
    }
    expect(await send("off")).toContain("event: message.completed");
    expect(await send("required")).toContain("event: reference.added");
    limited = true;
    expect(await send("off")).toContain(
      "subscription_sharing_usage_limit_exceeded",
    );
    const history = (await (
      await chat(new Request("http://localhost"), target, mockRpc)
    ).json()) as Turn[];
    expect(history.map((t) => t.status)).toEqual([
      "completed",
      "completed",
      "failed",
    ]);
    expect(history[0].answer).toBe("기본 답변");
    expect(history[0].metadata.references).toEqual([]);
    expect(history[1].metadata.references?.map((r) => r.kind)).toEqual([
      "citation",
      "candidate",
    ]);
    const archived = await mockRpc(
      "list_materials",
      { target: project, page_offset: 0 },
      false,
    );
    expect(archived).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cited: true,
          candidate: false,
          state: "link",
        }),
        expect.objectContaining({
          cited: false,
          candidate: true,
          state: "link",
        }),
      ]),
    );
    expect(history[2].answer).toBe("기본 답변");
    limited = false;
    const reference = (await mockRpc(
      "save_material",
      {
        target: project,
        source_kind: "text",
        source_title: "기록",
        source_origin: "직접 등록",
        source_body: "관측기록-987",
        source_state: "ready",
        source_note: "",
        pdf_hash: null,
      },
      true,
    )) as string;
    expect(await send("off", reference)).toContain("event: message.completed");
    expect(inputs.at(-1)).toContain("관측기록-987");
    expect(await send("off")).toContain("event: message.completed");
    expect(inputs.at(-1)).not.toContain("관측기록-987");
    await expect(send("off", crypto.randomUUID())).rejects.toThrow(
      "현재 프로젝트",
    );
    expect(transport).toHaveBeenCalledTimes(5);
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
});
