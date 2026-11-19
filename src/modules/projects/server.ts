import "server-only";
import { z } from "zod";
import type { Rpc } from "@/server/database/backend";
import type { Project } from "./types";
export const listProjects = async (rpc: Rpc) =>
  (await rpc("project_list", {}, false)) as Project[];
export async function projectsRoute(req: Request, rpc: Rpc) {
  if (req.method === "GET") return Response.json(await listProjects(rpc));
  const b = z
    .object({
      id: z.uuid(),
      name: z.string().trim().min(1).max(120),
      purpose: z.string().trim().max(2000),
    })
    .parse(await req.json());
  return Response.json({
    session_id: await rpc(
      "create_project",
      { request_id: b.id, project_name: b.name, project_purpose: b.purpose },
      true,
    ),
  });
}
