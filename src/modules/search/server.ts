import { z } from "zod";
import type { Rpc } from "@/server/database/backend";
export async function searchRoute(req: Request, rpc: Rpc) {
  const p = new URL(req.url).searchParams;
  return Response.json(
    await rpc(
      "research_search",
      {
        query_text: z
          .string()
          .max(500)
          .parse(p.get("q") || ""),
        category: z
          .enum(["", "session", "project", "material", "knowledge"])
          .parse(p.get("kind") || ""),
        page_offset: z.coerce
          .number()
          .int()
          .min(0)
          .parse(p.get("offset") || 0),
      },
      false,
    ),
  );
}
