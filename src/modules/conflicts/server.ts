import { z } from "zod";
import { Problem, type Rpc } from "@/server/database/backend";
export async function reviewRoute(req: Request, project: string, rpc: Rpc) {
  const target = z.uuid().parse(project);
  const args = z
    .object({
      item: z.uuid(),
      expected: z.number().int().positive(),
      choice: z.enum(["accept", "reject"]),
      edited: z.string().max(60000),
    })
    .parse(await req.json());
  const state = await rpc("review_knowledge", { target, ...args }, true);
  if (state === "stale")
    throw new Problem(
      409,
      "본문이 변경되었습니다. 최신 본문을 다시 확인하세요.",
    );
  return Response.json({ state });
}
