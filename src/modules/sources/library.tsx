"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { registerMaterial, readMaterial, materialPath } from "./client";
import { labels } from "./labels";

import { Button } from "@/shared/ui/button";
import { request } from "@/shared/lib/request";
import type { Material, MaterialRow } from "./types";
export function MaterialLibrary({
  project,
  revision,
  onOpen,
  onUpdated,
}: {
  project: string;
  revision: number;
  onOpen: (doc: Material) => void;
  onUpdated: (doc: Material) => void;
}) {
  const api = materialPath(project);
  const [items, setItems] = useState<MaterialRow[]>([]),
    [more, setMore] = useState(false);
  const [mode, setMode] = useState<"url" | "pdf" | "text">("url");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState(
      () => !!new URL(location.href).searchParams.get("material"),
    );

  const mounted = useRef(true);
  const version = useRef(0),
    selection = useRef(0);
  const list = useCallback(
    async (offset = 0) => {
      const seq = ++version.current;
      const rows: MaterialRow[] = await request(api + "?offset=" + offset);
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
    [api],
  );
  const open = useCallback(
    async (id: string) => {
      const seq = ++selection.current;
      const row: Material = await request(api + "/" + id);
      if (!mounted.current || seq !== selection.current) return;
      onOpen(row);
    },
    [api, onOpen],
  );
  useEffect(() => {
    mounted.current = true;
    list().catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
    };
  }, [list, revision]);
  useEffect(() => {
    let current = true;
    async function collect() {
      while (current) {
        const { id } = await request(api + "/collect", {});
        if (!current || !id) break;
        await list();
        if (current) onUpdated(await readMaterial(project, id));
      }
    }
    collect().catch((e) => {
      if (current) setError(e.message);
    });
    return () => {
      current = false;
    };
  }, [api, revision, list, project, onUpdated]);
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
      <details
        className="library"
        open={expanded}
        onToggle={(e) => setExpanded(e.currentTarget.open)}
      >
        <summary>프로젝트 자료함</summary>
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
        {items.length === 0 ? (
          <p>등록된 자료가 없습니다.</p>
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
                <small>{labels(row)}</small>
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
      </details>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
