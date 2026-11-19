"use client";
import { useEffect, useState } from "react";
import { request } from "@/shared/lib/request";
import { streamTurn } from "./stream-client";
import { SourceLink } from "@/shared/ui/source-link";
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
  const [digest, setDigest] = useState<{
    candidates: { id: string; summary: string }[];
    keywords: string[];
    followup: string;
  } | null>(null);
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
      {done && digest && (
        <div>
          <h3>독해 정리</h3>
          <p>{digest.keywords.join(" · ")}</p>
          {digest.followup && (
            <button
              onClick={() => {
                setDone(false);
                setQuestion(digest.followup);
              }}
            >
              {digest.followup}
            </button>
          )}
        </div>
      )}
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
          {done && digest?.candidates.find((c) => c.id === t.id)?.summary && (
            <p>{digest.candidates.find((c) => c.id === t.id)?.summary}</p>
          )}
          <strong>{t.question}</strong>
          <AnswerMarkdown text={t.answer} />
          {t.metadata.references
            ?.filter((r) => r.kind === "citation")
            .map((r) => (
              <SourceLink key={r.url} href={r.url}>
                {r.title}
              </SourceLink>
            ))}
        </article>
      ))}
      {partial && <AnswerMarkdown text={partial} />}
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
            onClick={() =>
              void run(async () => {
                const result = await request(api, {
                  action: "digest",
                  session,
                });
                setDigest(result);
                setDone(true);
                setIds(result.candidates.map((c: { id: string }) => c.id));
              })
            }
          >
            다 읽음
          </button>
        </form>
      )}
    </section>
  );
}
