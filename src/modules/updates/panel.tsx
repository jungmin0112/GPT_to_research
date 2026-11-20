"use client";
import { useCallback, useEffect, useState } from "react";
import { request } from "@/shared/lib/request";
import type { KnowledgeState } from "@/modules/knowledge";
export function UpdatePanel({
  project,
  refresh,
  localWorker,
}: {
  project: string;
  localWorker: boolean;
  refresh: () => void;
}) {
  const path = "projects/" + project + "/updates";
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [count, setCount] = useState(0);
  const update = useCallback(
    async (manual: boolean) => {
      setBusy(true);
      try {
        const result = await request(path, { manual });
        const state: KnowledgeState = await request(
          "projects/" + project + "/knowledge",
        );
        setCount(state.pending);
        if (manual || result.processed) {
          setStatus(result.processed + "건 처리");
          refresh();
        }
      } catch (e) {
        setStatus((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [project, path, refresh],
  );
  useEffect(() => {
    let active = true;
    let previous: string | undefined;
    async function readState() {
      try {
        const state: KnowledgeState = await request("projects/" + project + "/knowledge");
        if (!active) return;
        setCount(state.pending);
        const snapshot = JSON.stringify(state.changes.map(c => [c.id, c.state]));
        if (previous !== undefined && previous !== snapshot) refresh();
        previous = snapshot;
      } catch (e) {
        if (active) setStatus((e as Error).message);
      }
    }
    void readState();
    const timer = setInterval(() => localWorker ? void readState() : void update(false), 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [project, update, localWorker, refresh]);
  return (
    <div className="update-actions">
      <button disabled={busy} onClick={() => void update(true)}>
        {busy ? "갱신 중…" : "수동 갱신"}
      </button>
      <small>
        대기 {count}건 · {localWorker && "PC 작업자 · "}{status}
      </small>
    </div>
  );
}
