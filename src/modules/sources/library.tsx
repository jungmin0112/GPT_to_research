"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { registerMaterial, materialPath } from "./client";
import { labels } from "./labels";

import { Button } from "@/shared/ui/button";
import { request } from "@/shared/lib/request";
import type { Material, MaterialRow } from "./types";
export function MaterialLibrary({
  project,
  revision,
  attach = false,
  onOpen,
}: {
  project: string;
  revision: number;
  onOpen: (doc: Material) => void;
  attach?: boolean;
}) {
  const api = materialPath(project);
  const [items, setItems] = useState<MaterialRow[]>([]),
    [more, setMore] = useState(false);
  const [mode, setMode] = useState<"url" | "pdf" | "text">("url");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const version = useRef(0),
    selection = useRef(0);
  const list = useCallback(
    async (offset = 0) => {
      const seq = ++version.current;
      const rows: MaterialRow[] = await request(
        api +
          "?" +
          new URLSearchParams({ offset: String(offset), q: query, kind }),
      );
      if (!mounted.current || seq !== version.current) return;
      setItems((prev) =>
        offset
          ? [
              ...prev,
              ...rows.filter((r) => !prev.some((old) => old.id === r.id)),
            ]
          : rows,
      );
      setMore(rows.length === 50);
    },
    [api, query, kind],
  );
  const open = useCallback(
    async (id: string) => {
      const seq = ++selection.current;
      const row: Material = await request(api + "/" + id);
      if (!mounted.current || seq !== selection.current) return;
      if (attach && row.state !== "ready")
        throw Error("본문을 확보한 자료만 첨부할 수 있습니다.");
      onOpen(row);
    },
    [api, onOpen, attach],
  );
  useEffect(() => {
    mounted.current = true;
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) {
          setLoading(true);
          setError("");
          return list();
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [list, revision]);
  async function save(operation: () => Promise<{ id: string }>) {
    setBusy(true);
    setError("");
    try {
      const result = await operation();
      await list();
      await open(result.id);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section aria-label="프로젝트 자료함" className="catalog">
        <h2>{attach ? "자료 첨부" : "자료함"}</h2>
        <details className="registration">
          <summary>{attach ? "새 자료 첨부" : "자료 등록"}</summary>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                fields = new FormData(form);
              if (
                await save(async () => {
                  return registerMaterial(api, mode, fields);
                })
              )
                form.reset();
            }}
          >
            <label>
              자료 유형
              <select
                aria-label="자료 유형"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="url">URL</option>
                <option value="pdf">PDF</option>
                <option value="text">텍스트</option>
              </select>
            </label>
            {mode === "url" ? (
              <label>
                원문 URL
                <input
                  key="url"
                  type="url"
                  name="url"
                  required
                  maxLength={16000}
                />
              </label>
            ) : mode === "pdf" ? (
              <label>
                PDF 파일 (최대 8 MiB)
                <input
                  key="pdf"
                  type="file"
                  name="pdf"
                  accept=".pdf,application/pdf"
                  required
                />
              </label>
            ) : (
              <>
                <label>
                  자료 제목
                  <input name="title" required maxLength={500} />
                </label>
                <label>
                  붙여넣을 본문
                  <textarea name="text" required maxLength={750000} />
                </label>
              </>
            )}
            <Button disabled={busy}>{busy ? "등록 중…" : "자료 등록"}</Button>
          </form>
        </details>
        <div className="catalog-filter">
          <label>
            제목·출처 검색
            <input
              type="search"
              maxLength={500}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            자료 유형 필터
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">전체</option>
              <option value="url">URL</option>
              <option value="pdf">PDF</option>
              <option value="text">텍스트</option>
            </select>
          </label>
        </div>
        {loading ? (
          <p>자료를 찾는 중…</p>
        ) : items.length === 0 ? (
          <p>일치하는 자료가 없습니다.</p>
        ) : (
          <ul>
            {items.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    open(row.id).catch((e) => setError(e.message));
                  }}
                >
                  {row.title}
                </button>
                <small>
                  {row.origin} · {labels(row)}
                </small>
              </li>
            ))}
          </ul>
        )}
        {more && (
          <button
            onClick={() => list(items.length).catch((e) => setError(e.message))}
          >
            자료 더 보기
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </>
  );
}
