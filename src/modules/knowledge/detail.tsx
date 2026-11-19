"use client";
import { KnowledgeEditor } from "./editor";
import { exportPdf, exportMarkdown } from "./export";
import type { KnowledgeState, NodeRecord } from "./types";
import { SourceLink } from "@/shared/ui/source-link";
export function NodeDetail({
  node,
  state,
  openSession,
  openMaterial,
  refresh,
}: {
  node: NodeRecord;
  state: KnowledgeState;
  openSession: (id: string) => void;
  refresh: () => void;
  openMaterial: (id: string) => void;
}) {
  const history = state.changes.filter((c) => c.node_id === node.id);
  const weights = new Map<string, number>();
  for (const c of history)
    if (c.state === "applied" && c.session_id)
      weights.set(c.session_id, (weights.get(c.session_id) || 0) + c.weight);
  const total = [...weights.values()].reduce((s, n) => s + n, 0);
  return (
    <>
      <h2>{node.title}</h2>
      <small>
        {node.topic} · 버전 {node.revision}
      </small>
      <p className="material-body">{node.body}</p>
      <button onClick={() => exportMarkdown(node, history)}>
        Markdown 다운로드
      </button>
      <button onClick={() => exportPdf(node, history)}>PDF 다운로드</button>
      <h3>세션 기여도</h3>
      {!total && <p>세션 기여 근거가 없습니다.</p>}
      {[...weights.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, w]) => (
          <button key={id} onClick={() => openSession(id)}>
            세션 열기 · {((100 * w) / total).toFixed(1)}% · {id.slice(0, 8)}
          </button>
        ))}
      <KnowledgeEditor
        key={node.id + ":" + node.revision}
        node={node}
        state={state}
        refresh={refresh}
      />
      <h3>근거 및 변경 이력</h3>
      {state.edits
        ?.filter((e) => e.node_id === node.id || e.new_node === node.id)
        .map((e) => (
          <details key={e.id}>
            <summary>사용자 수정 · {e.created_at}</summary>
            <p>
              {e.previous.topic} · {e.previous.body}
            </p>
            <p>
              {e.updated.topic} · {e.updated.body}
            </p>
          </details>
        ))}
      {history.map((c) => (
        <details key={c.id}>
          <summary>
            {c.source_title} · {c.state}
          </summary>
          <blockquote>{c.quote}</blockquote>
          <p>{c.reason}</p>
          <p>이전 · {c.previous}</p>
          <p>제안 · {c.proposal}</p>
          {c.accepted && <p>반영 · {c.accepted}</p>}
          {c.kind === "material" ? (
            <button onClick={() => openMaterial(c.source_id)}>
              근거 원문 열기
            </button>
          ) : (
            c.session_id && (
              <button onClick={() => openSession(c.session_id!)}>
                근거 세션 열기
              </button>
            )
          )}
          {c.origin.kind === "url" && (
            <SourceLink href={c.origin.origin}>{c.origin.origin}</SourceLink>
          )}
          {c.origin.references
            ?.filter((r) => r.kind === "citation")
            .map((r, i) => (
              <SourceLink key={i} href={r.url}>
                {r.title}
              </SourceLink>
            ))}
        </details>
      ))}
    </>
  );
}
