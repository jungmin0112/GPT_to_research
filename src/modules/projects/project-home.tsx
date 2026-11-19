"use client";
import { useRef, useState } from "react";
import type { Project } from "./types";
import { request } from "@/shared/lib/request";
import { Button } from "@/shared/ui/button";
export function ProjectHome({
  projects,
  onSelect,
  onCreated,
}: {
  projects: Project[];
  onSelect: (id: string) => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const creation = useRef({ payload: "", id: "" });
  async function action(fn: () => Promise<void>) {
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
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <section className="home">
        <div className="heading">
          <h1>프로젝트</h1>
          <Button onClick={() => setCreating(true)}>새 프로젝트</Button>
        </div>
        {creating && (
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              void action(async () => {
                const payload = JSON.stringify(values);
                if (creation.current.payload !== payload)
                  creation.current = {
                    payload,
                    id: crypto.randomUUID(),
                  };
                const data = await request("projects", {
                  ...values,
                  id: creation.current.id,
                });
                await onCreated(data.session_id);
                creation.current = { payload: "", id: "" };
              });
            }}
          >
            <label>
              프로젝트 이름
              <input name="name" maxLength={120} required autoFocus />
            </label>
            <label>
              연구 목적
              <textarea name="purpose" maxLength={2000} />
            </label>
            <div className="actions">
              <Button disabled={busy}>생성하고 열기</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreating(false)}
              >
                취소
              </Button>
            </div>
          </form>
        )}
        {!projects.length && !creating && (
          <p>첫 프로젝트를 만들어 연구를 시작하세요.</p>
        )}
        {projects.map((p) => (
          <button
            className="project"
            key={p.id}
            onClick={() => onSelect(p.session_id)}
          >
            <strong>{p.name}</strong>
            <span>메인 세션 열기 ↗</span>
          </button>
        ))}
      </section>
    </>
  );
}
