"use client";
import { useState, useLayoutEffect, useRef } from "react";
import { SourceLink } from "@/shared/ui/source-link";
import { Button } from "@/shared/ui/button";
import type { Material } from "./types";
import { labels } from "./labels";
import { materialPath, readMaterial, retryMaterial } from "./client";
export function Reader({
  opened,
  project,
  close,
  onUpdated,
  position,
  onScroll,
  onRead,
}: {
  opened: Material;
  project: string;
  close: () => void;
  onUpdated: (doc: Material) => void;
  position: () => number;
  onRead: (quote: string) => void;
  onScroll: (value: number) => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const api = materialPath(project);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const view = useRef<HTMLDivElement>(null);
  const initial = useRef(position);
  useLayoutEffect(() => {
    if (view.current) view.current.scrollTop = initial.current();
  }, []);
  return (
    <section className="material-reader" aria-label="자료 상세">
      <button onClick={close}>자료 닫기</button>
      {error && <p role="alert">{error}</p>}
      <h2>{opened.title}</h2>
      <p>{labels(opened)}</p>
      <p>
        출처 ·{" "}
        {opened.kind === "url" ? (
          <SourceLink href={opened.origin}>{opened.origin}</SourceLink>
        ) : (
          opened.origin
        )}
      </p>
      {opened.kind === "pdf" && (
        <a href={"/api/" + api + "/" + opened.id + "/file"} download>
          원본 PDF 다운로드
        </a>
      )}
      {opened.state === "ready" && (
        <div>
          <button onClick={() => setSelecting(!selecting)}>
            {selecting ? "문단 선택 취소" : "문단 선택"}
          </button>
          <button onClick={() => onRead("")}>미니 세션 열기</button>
        </div>
      )}
      <div
        className="reader-scroll"
        tabIndex={0}
        aria-label="원문 본문"
        ref={view}
        onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
      >
        {opened.state === "ready" ? (
          <div className="material-body">
            {selecting
              ? opened.body
                  .split(/\n+/)
                  .filter(Boolean)
                  .map((p, i) => (
                    <button
                      className="paragraph-choice"
                      key={i}
                      onClick={() => {
                        onRead(p.slice(0, 5500));
                        setSelecting(false);
                      }}
                    >
                      {p}
                    </button>
                  ))
              : opened.body}
          </div>
        ) : (
          <>
            <p>{opened.note || "원문 본문을 아직 수집하지 않았습니다."}</p>
            {opened.kind === "url" && (
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError("");
                  retryMaterial(project, opened.origin)
                    .then(() => readMaterial(project, opened.id))
                    .then(onUpdated)
                    .catch((e) => setError(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                본문 가져오기
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
