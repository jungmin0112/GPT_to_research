"use client";
import { useEffect, useState } from "react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { request } from "@/shared/lib/request";
import type { Project } from "@/modules/projects";
import type { ExploreSession } from "@/modules/sessions";
import type { KnowledgeState } from "@/modules/knowledge";
type Item = {
  id: string;
  title: string;
  description: string;
  group: string;
  parent?: string;
  material?: string | null;
};
type GraphProps = {
  items: Item[];
  onOpen: (item: Item) => void;
  button: string;
};
function Graph({ items, onOpen, button }: GraphProps) {
  const [filter, setFilter] = useState(""),
    [group, setGroup] = useState(""),
    [preview, setPreview] = useState("");
  const shown = items.filter(
    (i) =>
      (!group || i.group === group) &&
      i.title.toLowerCase().includes(filter.toLowerCase()),
  );
  const selected = shown.find((i) => i.id === preview);
  const groups = [...new Set(items.map((i) => i.group))];
  const nodes = shown.map((i) => ({
    id: i.id,
    position: {
      x: groups.indexOf(i.group) * 210,
      y: shown.filter((j) => j.group === i.group).indexOf(i) * 85,
    },
    data: { label: i.title },
  }));
  const edges = shown.flatMap((i) =>
    i.parent && shown.some((j) => j.id === i.parent)
      ? [{ id: i.parent + i.id, source: i.parent, target: i.id }]
      : [],
  );
  return (
    <section>
      <label>
        그래프 필터
        <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      </label>
      <label>
        그룹
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">전체</option>
          {groups.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      {shown.length > 0 ? (
        <>
          <div style={{ height: 190 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              onNodeClick={(_, n) => setPreview(n.id)}
            >
              <Background />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          {shown.map((i) => (
            <button
              key={i.id}
              className="graph-node"
              onClick={() => setPreview(i.id)}
            >
              ◉ {i.title}
            </button>
          ))}
        </>
      ) : (
        <p>표시할 노드가 없습니다.</p>
      )}
      {selected && (
        <div className="node-preview">
          <strong>{selected.title}</strong>
          <p>{selected.description}</p>
          <button onClick={() => onOpen(selected)}>{button}</button>
        </div>
      )}
    </section>
  );
}
export function SessionGraph({
  project,
  onOpen,
  onMini,
}: {
  project: Project;
  onOpen: (id: string) => void;
  onMini: (id: string) => void;
}) {
  const [rows, setRows] = useState<ExploreSession[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request("projects/" + project.id + "/exploration")
      .then((r) => {
        if (active) setRows(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [project.id]);
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <Graph
        items={rows.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.kind === "main" ? project.purpose : r.title,
          group: { main: "메인", branch: "심화", mini: "독해" }[r.kind],
          parent: r.parent_id ?? undefined,
          material: r.kind === "mini" ? r.material_id : null,
        }))}
        onOpen={(i) => (i.material ? onMini(i.material) : onOpen(i.id))}
        button="세션 열기"
      />
    </>
  );
}
export function KnowledgeGraph({
  state,
  onOpen,
}: {
  state: KnowledgeState;
  onOpen: (id: string) => void;
}) {
  const topics = [...new Set(state.nodes.map((n) => n.topic))];
  const items: Item[] = [
    ...topics.map((t) => ({
      id: "topic:" + t,
      title: t,
      description: t,
      group: "주제",
    })),
    ...state.nodes.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.body,
      group: n.topic,
      parent: "topic:" + n.topic,
    })),
  ];
  return (
    <Graph
      items={items}
      button="결과물 열기"
      onOpen={(i) => {
        const node =
          state.nodes.find((n) => n.id === i.id) ||
          state.nodes.find((n) => "topic:" + n.topic === i.id);
        if (node) onOpen(node.id);
      }}
    />
  );
}
