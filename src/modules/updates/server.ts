import { z } from "zod";
import { Problem, type Rpc } from "@/server/database/backend";
import { analyzeEvidence, requireAnalysisAccess } from "@/modules/ai/server";
import type { KnowledgeState, Evidence } from "@/modules/knowledge";
export async function updateKnowledge(
  rpc: Rpc,
  target: string,
  manual: boolean,
) {
  let processed = 0;
  for (let i = 0; i < (manual ? 10 : 3); i++) {
    await requireAnalysisAccess();
    const job = crypto.randomUUID();
    const [event] = (await rpc(
      "claim_knowledge",
      { target, job, manual },
      false,
    )) as Evidence[];
    if (!event) break;
    try {
      const state = (await rpc(
        "knowledge_state",
        { target },
        true,
      )) as KnowledgeState;
      const decision = await analyzeEvidence(event, state.nodes.slice(0, 100));
      const outcome = await rpc(
        "commit_knowledge",
        { target, job, decision },
        true,
      );
      if (outcome === "stale") break;
      processed++;
    } catch {
      await rpc(
        "commit_knowledge",
        { target, job, decision: { action: "failed" } },
        true,
      );
      throw new Problem(
        502,
        "갱신 분석에 실패했습니다. 원본은 보관되어 있으며 다시 시도할 수 있습니다.",
      );
    }
  }
  return processed;
}
export async function updateRoute(req: Request, project: string, rpc: Rpc) {
  const target = z.uuid().parse(project);
  const { manual } = z.object({ manual: z.boolean() }).parse(await req.json());
  return Response.json({
    processed: await updateKnowledge(rpc, target, manual),
  });
}
