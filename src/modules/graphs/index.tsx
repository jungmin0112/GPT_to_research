"use client";
import { useState } from "react";
import type { Project } from "@/modules/projects";
export function SessionGraph({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: (id: string) => void;
}) {
  const [preview, setPreview] = useState(false);
  return (
    <section aria-label="세션 그래프 미리보기">
      <button className="graph-node" onClick={() => setPreview(true)}>
        ◉ 메인 세션
      </button>
      {preview && (
        <div className="node-preview">
          <strong>{project.name}</strong>
          <p>{project.purpose}</p>
          <button onClick={() => onOpen(project.session_id)}>세션 열기</button>
        </div>
      )}
    </section>
  );
}
