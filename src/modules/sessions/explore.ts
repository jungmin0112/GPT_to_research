import { z } from "zod";
import { type Rpc, Problem } from "@/server/database/backend";
export async function exploration(req: Request, project: string, rpc: Rpc) {
  const target = z.uuid().parse(project);
  if (req.method === "GET")
    return Response.json(await rpc("explore_sessions", { target }, false));
  const data = z
    .discriminatedUnion("action", [
      z.object({
        action: z.literal("anchor"),
        parent: z.uuid(),
        label: z.string().trim().min(1).max(120),
        request_id: z.uuid(),
        anchor_turn: z.uuid().nullable(),
        anchor_node: z.uuid().nullable(),
      }),
      z.object({
        action: z.literal("open"),
        parent: z.uuid().nullable(),
        material: z.uuid().nullable(),
        label: z.string().max(120),
        mini: z.boolean(),
        request_id: z.uuid(),
      }),
      z.object({
        action: z.literal("settings"),
        session: z.uuid(),
        level: z.number().int().min(0).max(3),
        external: z.boolean(),
      }),
      z.object({
        action: z.literal("forward"),
        mini_id: z.uuid(),
        selected: z.array(z.uuid()).min(1).max(100),
      }),
    ])
    .parse(await req.json());
  if (data.action === "settings") {
    const rows = (await rpc("explore_sessions", { target }, false)) as {
      id: string;
    }[];
    if (!rows.some((s) => s.id === data.session))
      throw new Problem(404, "세션을 찾을 수 없습니다.");
    await rpc(
      "context_settings",
      { target: data.session, level: data.level, external: data.external },
      true,
    );
    return Response.json({ ok: true });
  }
  const { action, ...args } = data;
  return Response.json(
    await rpc(
      action === "anchor"
        ? "anchored_branch"
        : action === "open"
          ? "open_exploration"
          : "forward_reading",
      { target, ...args },
      true,
    ),
  );
}
