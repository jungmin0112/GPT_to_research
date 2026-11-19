"use client";
import { useEffect, useState } from "react";
import { request } from "@/shared/lib/request";
export type Hit = {
  kind: "project" | "session" | "material" | "knowledge";
  id: string;
  project_id: string;
  title: string;
  excerpt: string;
};
const labels = {
  project: "프로젝트",
  session: "세션",
  material: "원문",
  knowledge: "결과물",
};
export function Search({
  open,
  projects,
}: {
  projects: { id: string; name: string }[];
  open: (hit: Hit) => void;
}) {
  const [q, setQ] = useState(""),
    [kind, setKind] = useState(""),
    [offset, setOffset] = useState(0),
    [rows, setRows] = useState<Hit[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        request(
          "search?" + new URLSearchParams({ q, kind, offset: String(offset) }),
        )
          .then((r) => {
            if (active) {
              setRows(r);
              setError("");
            }
          })
          .catch((e) => {
            if (active) setError(e.message);
          }),
      150,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, kind, offset]);
  return (
    <section className="catalog">
      <label>
        통합 검색
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
      </label>
      <label>
        검색 종류
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">전체</option>
          {Object.entries(labels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {rows.map((r) => (
        <article key={r.kind + r.id}>
          <button onClick={() => open(r)}>
            {labels[r.kind]} · {r.title}
          </button>
          <small>{projects.find((p) => p.id === r.project_id)?.name}</small>
          <p>{r.excerpt}</p>
        </article>
      ))}
      {offset > 0 && (
        <button onClick={() => setOffset(offset - 50)}>이전</button>
      )}
      {rows.length === 50 && (
        <button onClick={() => setOffset(offset + 50)}>다음</button>
      )}
    </section>
  );
}
