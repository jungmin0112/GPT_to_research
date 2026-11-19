"use client";
import { useEffect, useState } from "react";
import { request } from "@/shared/lib/request";
import { streamTurn } from "./stream-client";
import { AnswerMarkdown } from "./answer-markdown";
import type { Turn } from "@/shared/types/conversation";
export type Reading = { id: string; title: string; quote: string };
export function MiniReading({
  project,
  doc,
  onForward,
}: {
  project: string;
  doc: Reading;
  onForward: () => void;
}) {
  const api = "projects/" + project + "/exploration";
  const [session, setSession] = useState(""),
    [rows, setRows] = useState<Turn[]>([]),
    [question, setQuestion] = useState(""),
    [search, setSearch] = useState(false),
    [done, setDone] = useState(false),
    [ids, setIds] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [partial, setPartial] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const id = await request(api, {
        action: "open",
        parent: null,
        material: doc.id,
        mini: true,
        label: "",
        request_id: crypto.randomUUID(),
      });
      const records = await request("sessions/" + id + "/chat");
      if (active) {
        setRows(records);
        setSession(id);
      }
    }
    load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [api, doc.id]);
  async function run(fn: () => Promise<void>) {
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
    <section>
      <h3>{doc.title}</h3>
      <blockquote>{doc.quote}</blockquote>
      {rows.map((t) => (
        <article key={t.id}>
          {done && t.status === "completed" && (
            <label>
              <input
                type="checkbox"
                checked={ids.includes(t.id)}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, t.id]
                      : ids.filter((i) => i !== t.id),
                  )
                }
              />
              전달 선택
            </label>
          )}
          <strong>{t.question}</strong>
          <AnswerMarkdown text={t.answer} />
        </article>
      ))}
      {partial && <p>{partial}</p>}
      {error && <p role="alert">{error}</p>}
      {done ? (
        <>
          <button
            disabled={busy || !ids.length}
            onClick={() =>
              run(async () => {
                await request(api, {
                  action: "forward",
                  mini_id: session,
                  selected: ids,
                });
                setIds([]);
                onForward();
              })
            }
          >
            선택한 문답을 메인에 전달
          </button>
          <button onClick={() => setDone(false)}>계속 읽기</button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const path = "sessions/" + session + "/chat";
              await streamTurn(
                path,
                (doc.quote ? "선택 문단: " + doc.quote + "\n\n" : "") +
                  question,
                search ? "required" : "off",
                crypto.randomUUID(),
                doc.id,
                (t) => setPartial((v) => v + t),
                () => {},
              );
              setRows(await request(path));
              setPartial("");
              setQuestion("");
            });
          }}
        >
          <label>
            미니 세션 질문
            <textarea
              required
              maxLength={6000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={search}
              onChange={(e) => setSearch(e.target.checked)}
            />
            외부 검색 요청
          </label>
          <button disabled={!session || busy}>미니 질문 보내기</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDone(true);
              setIds([]);
            }}
          >
            다 읽음
          </button>
        </form>
      )}
    </section>
  );
}
