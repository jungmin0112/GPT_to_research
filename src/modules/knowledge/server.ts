import { z } from "zod";
import { type Rpc } from "@/server/database/backend";
export async function knowledgeRoute(req: Request, project: string, rpc: Rpc) {
  const target = z.uuid().parse(project);
  return Response.json(await rpc("knowledge_state", { target }, true));
}
