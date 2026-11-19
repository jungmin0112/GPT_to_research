import { sourceReference } from "@/modules/sources/server";
import { z } from "zod";
import { backend, Problem } from "@/server/database/backend";
import type { Turn } from "@/shared/types/conversation";
import { listProjects } from "@/modules/projects/server";
import { research, describeFailure } from "@/modules/ai/server";

export async function chat(
  req: Request,
  id: string,
  rpc: Awaited<ReturnType<typeof backend>>,
) {
  const target = z.uuid().parse(id);
  const project = (await listProjects(rpc)).find(
    (p) => p.session_id === target,
  );
  if (!project) throw new Problem(404, "세션을 찾을 수 없습니다.");
  const history = async () =>
    (await rpc("chat_history", { target }, false)) as Turn[];
  if (req.method === "GET") return Response.json(await history());
  const { text, client_message_id, search_mode, explicit_ref } = z
    .object({
      text: z.string().trim().min(1).max(12000),
      client_message_id: z.uuid(),
      explicit_ref: z.uuid().optional(),
      search_mode: z.enum(["auto", "off", "required"]),
    })
    .strict()
    .parse(await req.json());
  const previous = (await history()).find((t) => t.id === client_message_id);
  const priorRef = previous?.metadata.explicit_ref;
  if (previous && explicit_ref && explicit_ref !== priorRef)
    throw new Problem(409, "기존 질문의 자료 참조가 일치하지 않습니다.");
  const refId = explicit_ref ?? priorRef;
  const reference = refId
    ? await sourceReference(rpc, project.id, refId)
    : undefined;
  const attempt = crypto.randomUUID();
  const state = await rpc(
    reference ? "begin_source_turn" : "begin_turn",
    {
      target,
      turn: client_message_id,
      attempt,
      body: text,
      search: search_mode,
      ...(reference ? { material: reference.id } : {}),
    },
    true,
  );
  if (state !== "started" && state !== "completed")
    throw new Problem(
      409,
      "진행 중인 답변이나 이전 전송 내용을 확인해 주세요.",
    );
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: string, data: unknown) => {
        if (!closed)
          controller.enqueue(
            encoder.encode(
              "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n",
            ),
          );
      };
      let answer = "";
      try {
        emit("message.started", { userMessageId: client_message_id });
        if (state === "started") {
          const details = await research(
            project,
            await history(),
            search_mode,
            (chunk) => {
              answer += chunk;
              emit("text.delta", { text: chunk });
            },
            () => emit("search.status", { status: "searching" }),
            reference,
          );
          if (reference) {
            details.explicit_ref = reference.id;
            details.explicit_ref_title = reference.title;
          }
          if (!answer.trim()) throw Error("empty");
          if (
            !(await rpc(
              "finish_turn",
              { attempt, outcome: "completed", body: answer, details },
              true,
            ))
          )
            throw Error("stale");
          for (const ref of details.references || [])
            emit("reference.added", ref);
        }
        emit("message.completed", {
          userMessageId: client_message_id,
          ...(state === "started" ? { assistantMessageId: attempt } : {}),
        });
      } catch (cause) {
        const error = describeFailure(cause);
        let saved = false;
        try {
          saved = await rpc(
            "finish_turn",
            {
              attempt,
              outcome: "failed",
              body: answer,
              details: {
                error,
                ...(reference
                  ? {
                      explicit_ref: reference.id,
                      explicit_ref_title: reference.title,
                    }
                  : {}),
              },
            },
            true,
          );
        } catch {
          saved = false;
        }
        emit("error", {
          message: saved
            ? error
            : "답변 저장 상태를 확인해 주세요. 질문 기록은 유지됩니다.",
        });
      } finally {
        if (!closed) controller.close();
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
