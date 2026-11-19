"use client";
import { streamTurn } from "./stream-client";
import { loadLocal, saveLocal } from "@/shared/lib/session-storage";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SourceLink } from "@/shared/ui/source-link";
import { AnswerMarkdown } from "./answer-markdown";
import { Button } from "@/shared/ui/button";
import { request } from "@/shared/lib/request";
import type { SearchMode, Turn } from "@/shared/types/conversation";

export function Chat({
  session,
  onSaved,
  current,
  settings,
}: {
  session: string;
  onSaved: () => void;
  current?: { id: string; title: string; path: string };
  settings?: ReactNode;
}) {
  const path = "sessions/" + session + "/chat";
  const [turns, setTurns] = useState<Turn[] | null>(null),
    [error, setError] = useState("");
  const key = "chat:" + session;
  const [text, setText] = useState(() => loadLocal(key + ":text", "")),
    [pin, setPin] = useState<{ id: string; title: string } | null>(() =>
      loadLocal(key + ":pin", null),
    ),
    [mode, setMode] = useState<SearchMode>("off");
  const [sending, setSending] = useState(false),
    [partial, setPartial] = useState(""),
    [status, setStatus] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const restored = useRef(false),
    follow = useRef(true);
  useEffect(() => {
    saveLocal(key + ":text", text);
    saveLocal(key + ":pin", pin);
  }, [key, text, pin]);
  useEffect(() => {
    const el = transcript.current;
    if (!el || turns === null) return;
    if (!restored.current) {
      el.scrollTop = loadLocal(key + ":scroll", el.scrollHeight);
      restored.current = true;
    } else if (follow.current) el.scrollTop = el.scrollHeight;
  }, [key, turns, partial, sending]);
  const pending = useRef<{
    id: string;
    question: string;
    mode: SearchMode;
    ref?: string;
  } | null>(null);
  useEffect(() => {
    let current = true;
    request(path)
      .then((rows) => {
        if (current) setTurns(rows);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [path]);
  // A refresh during a stream can leave another tab waiting for its final row.
  const working = turns?.at(-1)?.status === "working";
  useEffect(() => {
    if (!working || sending) return;
    let current = true;
    const timer = setInterval(() => {
      request(path)
        .then((rows) => {
          if (current) setTurns(rows);
        })
        .catch(() => {
          if (current) setError("기록을 불러오지 못했습니다.");
        });
    }, 2000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [working, sending, path]);
  async function send(
    question: string,
    search: SearchMode,
    id: string,
    ref?: string,
  ) {
    setError("");
    follow.current = true;
    setPartial("");
    setStatus("답변 준비 중…");
    setSending(true);
    pending.current = { id, question, mode: search, ref };
    try {
      await streamTurn(
        path,
        question,
        search,
        id,
        ref,
        (chunk) => setPartial((prev) => prev + chunk),
        () => setStatus("웹 검색 중…"),
      );
      onSaved();
      pending.current = null;
      setText("");
      setPin(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      try {
        setTurns(await request(path));
      } catch {
        setError("대화 기록을 다시 불러와 주세요.");
      }
      setSending(false);
      setPartial("");
      setStatus("");
    }
  }
  return (
    <div className="chat">
      {error && <div role="alert">{error}</div>}
      <div
        className="transcript"
        ref={transcript}
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          if (restored.current) saveLocal(key + ":scroll", el.scrollTop);
        }}
      >
        {turns === null ? (
          <p>대화 기록 불러오는 중…</p>
        ) : (
          !turns.length &&
          !sending && <p>이 프로젝트에서 조사할 첫 질문을 입력하세요.</p>
        )}
        {turns?.map((t, i) => (
          <article key={t.id}>
            <h3>나</h3>
            <p className="user-question">{t.question}</p>
            <h3>연구 도우미</h3>
            {t.answer ? (
              <AnswerMarkdown text={t.answer} />
            ) : (
              t.status === "working" && <p>답변 작성 중…</p>
            )}
            {t.metadata.webSearchUsed && <small>웹 검색 사용</small>}
            {t.metadata.references?.map((ref, j) => (
              <SourceLink key={j} href={ref.url}>
                {ref.kind === "citation" ? "인용" : "검색 후보"} · {ref.title}
              </SourceLink>
            ))}
            {t.status === "failed" && (
              <>
                <p>{t.metadata.error || "답변이 중단되었습니다."}</p>
                {i === turns.length - 1 && (
                  <Button
                    disabled={sending}
                    variant="secondary"
                    onClick={() =>
                      send(
                        t.question,
                        t.search_mode,
                        t.id,
                        t.metadata.explicit_ref,
                      )
                    }
                  >
                    답변 재시도
                  </Button>
                )}
              </>
            )}
          </article>
        ))}
        {sending && (
          <article aria-live="polite">
            <h3>{status}</h3>
            <AnswerMarkdown text={partial} />
          </article>
        )}
      </div>
      {settings}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const draft = text.trim();
          if (!draft) return;
          const old = pending.current;
          void send(
            draft,
            mode,
            old?.question === draft && old.mode === mode && old.ref === pin?.id
              ? old.id
              : crypto.randomUUID(),
            pin?.id,
          );
        }}
      >
        {current && (
          <button
            type="button"
            disabled={sending}
            onClick={() => {
              setText(
                (old) =>
                  (old ? old + "\n\n" : "") +
                  "이 질문은 현재 읽고 있는 [" +
                  current.path +
                  "]의 내용과 관련된 질문입니다. 해당 내용을 참고하여 답변해 주세요.",
              );
              setPin({ id: current.id, title: current.title });
              input.current?.focus();
            }}
          >
            현재 자료로 질문하기
          </button>
        )}
        {pin && (
          <button
            type="button"
            disabled={sending}
            aria-label="참조 해제"
            onClick={() => setPin(null)}
          >
            참조 · {pin.title} ×
          </button>
        )}
        <label>
          <span className="sr-only">질문</span>
          <textarea
            aria-label="질문"
            ref={input}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                e.nativeEvent.keyCode !== 229
              ) {
                e.preventDefault();
                if (!sending && !working && turns && text.trim())
                  e.currentTarget.form?.requestSubmit();
              }
            }}
            value={text}
            disabled={sending}
            onChange={(e) => setText(e.target.value)}
            maxLength={12000}
            placeholder="무엇을 조사할까요?"
            required
          />
        </label>
        <div className="actions">
          <label>
            웹 검색
            <select
              value={mode}
              disabled={sending}
              onChange={(e) => setMode(e.target.value as SearchMode)}
            >
              <option value="auto">자동</option>
              <option value="off">사용 안 함</option>
              <option value="required">검색 요청</option>
            </select>
          </label>
          <Button disabled={!text.trim() || sending || working || !turns}>
            전송
          </Button>
        </div>
      </form>
    </div>
  );
}
