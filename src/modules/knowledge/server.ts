import { Problem } from "@/server/database/backend";
import { z } from "zod";
import { type Rpc } from "@/server/database/backend";
export async function knowledgeRoute(req: Request, project: string, rpc: Rpc) {
  const target = z.uuid().parse(project);
  if (req.method === "POST") {
    const args = z
      .object({
        node: z.uuid(),
        expected: z.number().int().positive(),
        content: z.string().trim().min(1).max(60000),
        category: z.string().trim().min(1).max(120),
        separate: z.uuid().nullable(),
        new_title: z.string().trim().max(200),
      })
      .parse(await req.json());
    const result = await rpc("edit_knowledge", { target, ...args }, true);
    if (result === "stale")
      throw new Problem(409, "최신 본문을 다시 불러온 후 수정하세요.");
    return Response.json({ result });
  }
  return Response.json(await rpc("knowledge_state", { target }, true));
}
export async function nodeReference(rpc: Rpc, target: string, id: string) {
  const state = (await rpc(
    "knowledge_state",
    { target },
    true,
  )) as import("./types").KnowledgeState;
  const node = state.nodes.find((n) => n.id === id);
  if (!node) throw new Problem(404, "프로젝트 결과물을 찾을 수 없습니다.");
  return { id: node.id, title: node.title, body: node.body.slice(0, 24000) };
}
