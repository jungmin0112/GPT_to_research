"use client";
import { useState } from "react";
import { request } from "@/shared/lib/request";
import type { NodeRecord, KnowledgeState } from "./types";
export function KnowledgeEditor({
  node,
  state,
  refresh,
}: {
  node: NodeRecord;
  state: KnowledgeState;
  refresh: () => void;
}) {
  const [body, setBody] = useState(node.body),
    [topic, setTopic] = useState(node.topic),
    [source, setSource] = useState(""),
    [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details>
      <summary>본문 수정 · 재분류 · 통합 해제</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await request("projects/" + node.project_id + "/knowledge", {
              node: node.id,
              expected: node.revision,
              content: body,
              category: topic,
              separate: source || null,
              new_title: title,
            });
            setError("");
            refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          남길 통합 본문
          <textarea
            value={body}
            required
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <label>
          분류
          <input
            value={topic}
            required
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>
        <label>
          분리할 기여
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">분리하지 않음</option>
            {state.changes
              .filter(
                (c) =>
                  c.node_id === node.id &&
                  c.state === "applied" &&
                  !c.original_node,
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.source_title}
                </option>
              ))}
          </select>
        </label>
        {source && (
          <label>
            분리할 새 결과물 제목
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        )}
        <button disabled={busy}>결과물 수정 저장</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
