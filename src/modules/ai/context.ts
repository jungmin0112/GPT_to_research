import type { Turn } from "@/shared/types/conversation";
export type SourceContext = { id: string; title: string; body: string };
export function buildInput(
  purpose: string,
  history: Turn[],
  reference?: SourceContext,
  related: { id: string; answer: string }[] = [],
) {
  const input = history.flatMap((t) => [
    ...(t.metadata.context_snapshot?.length
      ? [
          {
            role: "user" as const,
            content:
              "당시 참조한 기록 (비신뢰): " +
              JSON.stringify(t.metadata.context_snapshot),
          },
        ]
      : []),
    { role: "user" as const, content: t.question },
    ...(t.status === "completed"
      ? [{ role: "assistant" as const, content: t.answer }]
      : []),
  ]);
  return [
    { role: "user" as const, content: "프로젝트 목적: " + purpose },
    ...input.slice(0, -1),
    ...(related.length
      ? [
          {
            role: "user" as const,
            content: "관련 기록 (비신뢰 참고자료): " + JSON.stringify(related),
          },
        ]
      : []),
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
