"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { Chat, BranchControls, type Reading } from "@/modules/sessions";
import {
  MaterialLibrary,
  useCollection,
  Reader,
  readMaterial,
  type Material,
} from "@/modules/sources";
import { NodeDetail, type KnowledgeState } from "@/modules/knowledge";
import { request } from "@/shared/lib/request";
import { PlanSettings } from "@/modules/ai";
import { loadLocal, saveLocal } from "@/shared/lib/session-storage";

type View = { tabs: string[]; active: string; panes: string[]; ratio: number };
const empty: View = { tabs: [], active: "", panes: [], ratio: 50 };
function show(v: View, id: string): View {
  const tabs = v.tabs.includes(id) ? v.tabs : [...v.tabs, id];
  const panes = v.panes.includes(id)
    ? v.panes
    : v.panes.length === 2
      ? v.panes.map((p, i) =>
          i === Math.max(0, v.panes.indexOf(v.active)) ? id : p,
        )
      : [id];
  return { ...v, tabs, panes, active: id };
}
type WorkspaceDoc =
  Material | { id: string; title: string; state: "ready"; result: true };
async function readDocument(
  project: string,
  id: string,
): Promise<WorkspaceDoc> {
  if (!id.startsWith("node:")) return readMaterial(project, id);
  const state: KnowledgeState = await request(
    "projects/" + project + "/knowledge",
  );
  const row = state.nodes.find((n) => n.id === id.slice(5));
  if (!row) throw Error("결과물을 찾을 수 없습니다.");
  return { id, title: row.title, state: "ready", result: true };
}
export function MaterialWorkspace({
  project,
  session,
  name,
  mock,
  screen,
  onChat,
  onRead,
  onBranch,
  onEvidenceSession,
  chatRevision,
  knowledge,
  documentRequest,
  refreshKnowledge,
}: {
  project: string;
  session: string;
  name: string;
  mock: boolean;
  screen: string;
  onRead: (doc: Reading) => void;
  onBranch: (id: string) => void;
  onEvidenceSession: (id: string) => void;
  chatRevision: number;
  knowledge: KnowledgeState;
  refreshKnowledge: () => void;
  documentRequest: { id: string; project: string } | null;
  onChat: () => void;
}) {
  const key = "workspace:" + session;
  const [view, setView] = useState<View>(empty),
    [docs, setDocs] = useState<Record<string, WorkspaceDoc>>({});
  const [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const touched = useRef(false);
  const update = useCallback(
    (doc: WorkspaceDoc) => setDocs((prev) => ({ ...prev, [doc.id]: doc })),
    [],
  );
  const refresh = useCallback(
    (doc: Material) =>
      setDocs((prev) => (prev[doc.id] ? { ...prev, [doc.id]: doc } : prev)),
    [],
  );
  const open = useCallback(
    (doc: WorkspaceDoc) => {
      touched.current = true;
      update(doc);
      setView((v) => show(v, doc.id));
    },
    [update],
  );
  useEffect(() => {
    let current = true;
    async function restore() {
      const saved = loadLocal<View>(key, empty);
      const deep = new URL(location.href).searchParams.get("material");
      const ids = [
        ...new Set([
          ...(Array.isArray(saved.tabs) ? saved.tabs : []),
          ...(deep ? [deep] : []),
        ]),
      ];
      const rows = await Promise.allSettled(
        ids.map((id) => readDocument(project, id)),
      );
      if (!current || touched.current) return;
      const found = rows.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
      );
      const tabs = found.map((m) => m.id);
      const active =
        [deep, saved.active, ...tabs].find((id) => id && tabs.includes(id)) ||
        "";
      const panes = (saved.panes || [])
        .filter((id) => tabs.includes(id))
        .slice(0, 2);
      const next = {
        tabs,
        active,
        panes: panes.length ? panes : active ? [active] : [],
        ratio: saved.ratio || 50,
      };
      setDocs(Object.fromEntries(found.map((doc) => [doc.id, doc])));
      setView(active ? show(next, active) : next);
      if (rows.some((r) => r.status === "rejected"))
        setError("일부 열린 자료를 복원할 수 없습니다.");
    }
    restore()
      .catch(() => {
        if (current) setError("작업 공간을 복원하지 못했습니다.");
      })
      .finally(() => {
        if (current) setReady(true);
      });
    return () => {
      current = false;
    };
  }, [key, project]);
  useEffect(() => {
    if (!ready || (error && !touched.current)) return;
    saveLocal(key, view);
    const url = new URL(location.href);
    if (view.active) url.searchParams.set("material", view.active);
    else url.searchParams.delete("material");
    history.replaceState(null, "", url);
  }, [ready, key, view, error]);
  function close(id: string) {
    setExpanded(false);
    setView((v) => {
      const tabs = v.tabs.filter((t) => t !== id),
        remaining = v.panes.filter((t) => t !== id);
      const active =
        v.active !== id ? v.active : remaining[0] || tabs.at(-1) || "";
      return {
        ...v,
        tabs,
        active,
        panes: remaining.length ? remaining : active ? [active] : [],
      };
    });
  }
  const [expanded, setExpanded] = useState(false);
  const [archiveRevision, bumpArchive] = useState(0);
  const collected = useCallback(
    (doc: Material) => {
      refresh(doc);
      bumpArchive((n) => n + 1);
    },
    [refresh],
  );
  const collectionError = useCollection(project, revision, collected);
  useEffect(() => {
    let live = true;
    if (documentRequest?.project === project)
      readDocument(project, documentRequest.id)
        .then((d) => {
          if (live) open(d);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [project, documentRequest, open]);
  const current = docs[view.active];
  return (
    <>
      {screen === "chat" && (
        <BranchControls
          project={project}
          session={session}
          material={current && !("result" in current) ? current.id : null}
          node={current?.id.startsWith("node:") ? current.id.slice(5) : null}
          open={onBranch}
        />
      )}
      {screen === "settings" && (
        <div className="settings-screen">
          {mock ? <p>로컬 테스트 계정</p> : <PlanSettings session={session} />}
        </div>
      )}
      {screen === "library" && (
        <MaterialLibrary
          project={project}
          revision={revision + archiveRevision}
          onOpen={(doc) => {
            open(doc);
            onChat();
          }}
        />
      )}
      {collectionError && screen !== "settings" && (
        <p className="collection-error" role="alert">
          검색 자료 수집 · {collectionError}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div
        hidden={screen !== "chat"}
        className={
          view.active
            ? "desk desk-reading" + (expanded ? " reader-expanded" : "")
            : "desk"
        }
      >
        <Chat
          revision={chatRevision}
          session={session}
          branchFrom={async (turn, title) => {
            const id = await request("projects/" + project + "/exploration", {
              action: "anchor",
              parent: session,
              label: title.slice(0, 120),
              request_id: crypto.randomUUID(),
              anchor_turn: turn,
              anchor_node: null,
            });
            onBranch(id);
          }}
          attachments={(select) => (
            <MaterialLibrary
              project={project}
              revision={revision + archiveRevision}
              attach
              onOpen={select}
            />
          )}
          onOpenAttachment={async (id) => open(await readDocument(project, id))}
          onSaved={() => setRevision((n) => n + 1)}
          current={
            current?.state === "ready"
              ? {
                  id: current.id,
                  title: current.title,
                  path: name + " / " + current.title,
                }
              : undefined
          }
          settings={
            !mock && screen === "chat" ? (
              <PlanSettings modelOnly session={session} />
            ) : undefined
          }
        />
        {view.active && (
          <div className="documents">
            <div className="document-tools">
              <div role="tablist" aria-label="열린 자료">
                {view.tabs.map((id) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={id === view.active}
                    onClick={() => setView((v) => show(v, id))}
                  >
                    {docs[id]?.title}
                  </button>
                ))}
              </div>
              <button onClick={() => setExpanded(!expanded)}>
                {expanded ? "대화와 함께 보기" : "원문 확장"}
              </button>
              {view.tabs.length > 1 && (
                <button
                  onClick={() =>
                    setView((v) => ({
                      ...v,
                      panes:
                        v.panes.length === 2
                          ? [v.active]
                          : [v.active, v.tabs.find((id) => id !== v.active)!],
                    }))
                  }
                >
                  {view.panes.length === 2 ? "분할 해제" : "2분할"}
                </button>
              )}
            </div>
            {view.panes.length === 2 && (
              <label className="split-control">
                분할 비율
                <input
                  type="range"
                  min="30"
                  max="70"
                  value={view.ratio}
                  onChange={(e) =>
                    setView((v) => ({ ...v, ratio: Number(e.target.value) }))
                  }
                />
              </label>
            )}
            <div
              className="panes"
              style={{
                gridTemplateColumns:
                  view.panes.length === 2
                    ? `minmax(0,${view.ratio}fr) minmax(0,${100 - view.ratio}fr)`
                    : "minmax(0,1fr)",
              }}
            >
              {view.panes.map(
                (id) =>
                  docs[id] && (
                    <div
                      key={id}
                      className={view.active === id ? "selected-pane" : ""}
                      onPointerDown={() =>
                        setView((v) => ({ ...v, active: id }))
                      }
                      onFocusCapture={() =>
                        setView((v) =>
                          v.active === id ? v : { ...v, active: id },
                        )
                      }
                    >
                      {"result" in docs[id] ? (
                        <section
                          className="material-reader"
                          aria-label="결과물 상세"
                        >
                          <button onClick={() => close(id)}>결과물 닫기</button>
                          <div
                            className="reader-scroll"
                            ref={(el) => {
                              if (el)
                                el.scrollTop = loadLocal(
                                  key + ":scroll:" + id,
                                  0,
                                );
                            }}
                            onScroll={(e) =>
                              saveLocal(
                                key + ":scroll:" + id,
                                e.currentTarget.scrollTop,
                              )
                            }
                          >
                            {knowledge.nodes
                              .filter((n) => "node:" + n.id === id)
                              .map((n) => (
                                <NodeDetail
                                  refresh={refreshKnowledge}
                                  key={n.id}
                                  node={n}
                                  state={knowledge}
                                  openSession={onEvidenceSession}
                                  openMaterial={(item) =>
                                    readMaterial(project, item)
                                      .then(open)
                                      .catch((e) => setError(e.message))
                                  }
                                />
                              ))}
                          </div>
                        </section>
                      ) : (
                        <Reader
                          opened={docs[id] as Material}
                          onRead={(quote) =>
                            onRead({ id, title: docs[id].title, quote })
                          }
                          project={project}
                          close={() => close(id)}
                          onUpdated={update}
                          position={() => loadLocal(key + ":scroll:" + id, 0)}
                          onScroll={(n) => saveLocal(key + ":scroll:" + id, n)}
                        />
                      )}
                    </div>
                  ),
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
