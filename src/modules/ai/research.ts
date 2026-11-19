import "server-only";
import type { Project } from "@/modules/projects";
import type { Turn, Details, SearchMode } from "@/shared/types/conversation";
import { mockMode } from "@/server/database/backend";
import { streamResponse } from "@/server/integrations/chatgpt/responses";
import { buildInput, type SourceContext } from "./context";
export async function research(
  project: Project,
  history: Turn[],
  mode: SearchMode,
  delta: (text: string) => void,
  searching: () => void,
  reference?: SourceContext,
  related: { id: string; answer: string }[] = [],
): Promise<Details> {
  const last = history.at(-1)!;
  if (mockMode()) {
    if (mode === "required") searching();
    for (const text of ["테스트 응답입니다. ", last.question]) delta(text);
    return {
      model: "mock",
      references:
        mode === "required"
          ? [
              {
                kind: "citation",
                url: "https://example.org/",
                title: "테스트용 출처",
              },
            ]
          : [],
    };
  }
  return streamResponse(
    buildInput(project.purpose, history, reference, related),
    mode,
    delta,
    searching,
  );
}
