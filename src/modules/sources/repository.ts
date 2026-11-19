import { Problem, type Rpc } from "@/server/database/backend";
import type { Material } from "./types";
export async function sourceReference(rpc: Rpc, project: string, id: string) {
  const [source] = (await rpc(
    "read_material",
    { target: project, item: id },
    false,
  )) as Material[];
  if (!source || source.state !== "ready")
    throw new Problem(
      400,
      "현재 프로젝트에서 본문을 확보한 자료를 선택하세요.",
    );
  return {
    id: source.id,
    title: source.title,
    body: source.body.slice(0, 24000),
  };
}
