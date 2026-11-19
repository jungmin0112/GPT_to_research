"use client";
import { useEffect, useState } from "react";
import { request } from "@/shared/lib/request";
export type ExploreSession = {
  id: string;
  title: string;
  kind: "main" | "mini" | "branch";
  parent_id: string | null;
  context_level: number;
  parent_scope: number;
  peer_scope: number;
  knowledge_scope: number;
  cross_project: boolean;
  material_id: string | null;
};
export function BranchControls({
  project,
  session,
  open,
  material,
  node,
}: {
  project: string;
  session: string;
  open: (id: string) => void;
  material: string | null;
  node: string | null;
}) {
  const api = "projects/" + project + "/exploration";
  const [rows, setRows] = useState<ExploreSession[]>([]),
    [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    request(api)
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [api, session]);
  const row = rows.find((r) => r.id === session);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function settings(
    level: number,
    external: boolean,
    extra: Record<string, number> = {},
  ) {
    await request(api, {
      action: "settings",
      session,
      level,
      external,
      parent_scope: row?.parent_scope,
      peer_scope: row?.peer_scope,
      knowledge_scope: row?.knowledge_scope,
      ...extra,
    });
    setRows(await request(api));
  }
  return (
    <details className="branch-tools">
      <summary>심화 탐구 · 참조 설정</summary>
      {error && <p role="alert">{error}</p>}
      {row?.parent_id && (
        <button onClick={() => open(row.parent_id!)}>상위 세션으로 복귀</button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            const id = await request(api, {
              action: node ? "anchor" : "open",
              anchor_node: node,
              anchor_turn: null,
              parent: session,
              material,
              mini: false,
              label: title,
              request_id: crypto.randomUUID(),
            });
            open(id);
          });
        }}
      >
        <label>
          심화 세션 제목
          <input
            maxLength={120}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button disabled={busy}>분기 생성</button>
      </form>
      {rows
        .filter((r) => r.kind === "branch")
        .map((r) => (
          <button key={r.id} onClick={() => open(r.id)}>
            {r.title}
          </button>
        ))}
      {row && (
        <>
          <label>
            외부 기록 참조 범위 ({row.context_level})
            <input
              aria-label="참조 수준"
              type="range"
              min="0"
              max="4"
              value={row.context_level}
              disabled={busy}
              onChange={(e) =>
                void act(() =>
                  settings(Number(e.target.value), row.cross_project),
                )
              }
            />
          </label>
          <details>
            <summary>고급 참조</summary>
            {(["parent_scope", "peer_scope", "knowledge_scope"] as const).map(
              (k, i) => (
                <label key={k}>
                  {["상위 세션", "다른 세션", "통합 조사 기록"][i]} · {row[k]}
                  <input
                    type="range"
                    min="0"
                    max="4"
                    value={row[k]}
                    disabled={busy}
                    onChange={(e) =>
                      void act(() =>
                        settings(row.context_level, row.cross_project, {
                          [k]: Number(e.target.value),
                        }),
                      )
                    }
                  />
                </label>
              ),
            )}
            <label>
              <input
                type="checkbox"
                checked={row.cross_project}
                disabled={busy}
                onChange={(e) =>
                  void act(() => settings(row.context_level, e.target.checked))
                }
              />
              다른 프로젝트 대화 포함
            </label>
          </details>
        </>
      )}
    </details>
  );
}
