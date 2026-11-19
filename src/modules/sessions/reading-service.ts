import { createHash } from "node:crypto";
import { summarizeReading } from "@/modules/ai/server";
import { Problem, type Rpc } from "@/server/database/backend";
import type { Turn } from "@/shared/types/conversation";
export async function readingSummary(
  rpc: Rpc,
  project: string,
  session: string,
) {
  const sessions = (await rpc(
    "explore_sessions",
    { target: project },
    false,
  )) as { id: string; kind: string }[];
  if (!sessions.some((s) => s.id === session && s.kind === "mini"))
    throw new Problem(404, "원문 세션이 없습니다.");
  const rows = (
    (await rpc("chat_history", { target: session }, false)) as Turn[]
  ).filter((t) => t.status === "completed");
  const signature = createHash("sha256")
    .update(JSON.stringify(rows.map((t) => [t.id, t.answer])))
    .digest("hex");
  const args = { target: session, signature };
  const cached = await rpc("reading_digest", { ...args, summary: null }, true);
  if (cached) return cached;
  const summary = await summarizeReading(rows);
  return rpc("reading_digest", { ...args, summary }, true);
}
