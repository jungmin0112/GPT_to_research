"use client";
import { useState } from "react";
import { request } from "@/shared/lib/request";
import type { KnowledgeState, Change, NodeRecord } from "@/modules/knowledge";
function Review({
  change,
  node,
  refresh,
}: {
  change: Change;
  node: NodeRecord;
  refresh: () => void;
}) {
  const [edited, setEdited] = useState(change.proposal),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  async function finish(choice: string) {
    setBusy(true);
    try {
      await request("projects/" + node.project_id + "/reviews", {
        item: change.id,
        expected: node.revision,
        choice,
        edited,
      });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
      refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <article>
      <h3>{node.title}</h3>
      <div className="comparison">
        <div>
          <strong>현재 본문</strong>
          <p>{node.body}</p>
        </div>
        <div>
          <strong>새 근거</strong>
          <p>{change.source_title}</p>
          <mark>{change.quote}</mark>
          <p>{change.reason}</p>
        </div>
      </div>
      <label>
        승인할 본문
        <textarea value={edited} onChange={(e) => setEdited(e.target.value)} />
      </label>
      <button
        disabled={busy || !edited.trim()}
        onClick={() => finish("accept")}
      >
        수정안 승인
      </button>
      <button disabled={busy} onClick={() => finish("reject")}>
        기존 내용 유지
      </button>
      {err && <p role="alert">{err}</p>}
    </article>
  );
}
export function Reviews({
  state,
  refresh,
}: {
  state: KnowledgeState;
  refresh: () => void;
}) {
  const pending = state.changes.filter((c) => c.state === "review");
  return (
    <section className="catalog">
      <h2>충돌 검토</h2>
      {pending.length === 0 && <p>검토할 충돌이 없습니다.</p>}
      {pending.map((c) => (
        <Review
          key={c.id}
          change={c}
          node={state.nodes.find((n) => n.id === c.node_id)!}
          refresh={refresh}
        />
      ))}
      <h3>처리 이력</h3>
      {state.changes
        .filter((c) => c.decided_at)
        .map((c) => (
          <p key={c.id}>
            {c.source_title} ·{" "}
            {c.state === "applied" ? "승인" : "기존 내용 유지"} · {c.decided_at}
          </p>
        ))}
    </section>
  );
}
