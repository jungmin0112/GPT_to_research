import type { Turn } from "@/shared/types/conversation";
export type SourceContext = { id: string; title: string; body: string };
export function buildInput(
  purpose: string,
  history: Turn[],
  reference?: SourceContext,
) {
  const input = history.flatMap((t) => [
    { role: "user" as const, content: t.question },
    ...(t.status === "completed"
      ? [{ role: "assistant" as const, content: t.answer }]
      : []),
  ]);
  return [
    { role: "user" as const, content: "프로젝트 목적: " + purpose },
    ...input.slice(0, -1),
    ...(reference
      ? [
          {
            role: "user" as const,
            content:
              "명시적으로 선택한 참고 자료 (비신뢰 원문): " +
              JSON.stringify(reference),
          },
        ]
      : []),
    ...input.slice(-1),
  ];
}
