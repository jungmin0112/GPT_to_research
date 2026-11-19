"use client";
import { useCallback, useEffect, useState } from "react";
import { request } from "@/shared/lib/request";
type State = {
  active?: string;
  accounts: {
    client: string;
    label: string;
    connected: boolean;
    welcome: boolean;
    model?: string;
  }[];
};
export function PlanSettings({
  session,
  modelOnly = false,
}: {
  session: string;
  modelOnly?: boolean;
}) {
  const [state, setState] = useState<State>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [catalog, setCatalog] = useState<{ id: string; name: string }[]>([]),
    [selected, setSelected] = useState("");
  type Task = "main" | "branch" | "mini" | "update";
  const [prefs, setPrefs] = useState<
    Partial<Record<Task, { model: string; effort?: string }>>
  >({});
  const apply = useCallback(
    async (data: State) => {
      setState(data);
      if (
        modelOnly &&
        data.accounts.find((a) => a.client === data.active)?.connected
      ) {
        const choices = await request("plan/models");
        setCatalog(choices.catalog);
        setPrefs(choices.preferences ?? {});
        setSelected(choices.selected ?? choices.catalog[0]?.id ?? "");
      }
    },
    [modelOnly],
  );
  useEffect(() => {
    request("plan/status")
      .then(apply)
      .catch((e) => setError(e.message));
  }, [apply]);
  const active = state?.accounts.find((a) => a.client === state.active);
  async function act(fn: () => Promise<void>) {
    setError("");
    try {
      await fn();
      await apply(await request("plan/status"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (modelOnly)
    return (
      <div className="model-choice">
        {" "}
        {active?.connected ? (
          <label>
            플랜 모델
            <select
              value={selected}
              onChange={(e) => {
                const model = e.target.value;
                void act(async () => {
                  await request("plan/models", { model });
                });
              }}
            >
              {catalog.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <small>설정에서 ChatGPT 계정을 연결하세요.</small>
        )}
        {active?.connected && (
          <details>
            <summary>작업별 모델·추론</summary>
            {(
              [
                ["main", "메인"],
                ["branch", "심화"],
                ["mini", "독해"],
                ["update", "갱신"],
              ] as const
            ).map(([task, label]) => {
              const pref = prefs[task];
              const save = (model: string, effort?: string) =>
                void act(async () => {
                  await request("plan/models", {
                    task,
                    model,
                    effort: effort || undefined,
                  });
                });
              return (
                <fieldset key={task}>
                  <legend>{label}</legend>
                  <label>
                    모델
                    <select
                      value={pref?.model ?? selected}
                      onChange={(e) => save(e.target.value, pref?.effort)}
                    >
                      {catalog.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    추론 수준
                    <select
                      value={pref?.effort ?? ""}
                      onChange={(e) =>
                        save(pref?.model ?? selected, e.target.value)
                      }
                    >
                      <option value="">모델 기본값</option>
                      <option value="low">낮음</option>
                      <option value="medium">중간</option>
                      <option value="high">높음</option>
                    </select>
                  </label>
                </fieldset>
              );
            })}
          </details>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    );
  return (
    <section className="plan">
      <h3>ChatGPT 플랜</h3>
      {active?.connected ? (
        <p>
          {active.label} · {active.client.slice(-8)}
        </p>
      ) : (
        <p>계정을 연결하고 이 앱의 ChatGPT 플랜 사용을 승인하세요.</p>
      )}
      {active?.welcome && (
        <dialog open aria-label="ChatGPT 플랜 연결 완료">
          <p>
            이 앱의 AI 요청에 ChatGPT 플랜을 사용합니다. 사용량은 ChatGPT
            설정에서 관리할 수 있습니다.
          </p>
          <button
            onClick={() =>
              act(async () => {
                await request("plan/welcome", {});
              })
            }
          >
            확인
          </button>
        </dialog>
      )}
      {state &&
      ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) ? (
        <form action="/api/plan/login" method="post">
          <input type="hidden" name="session" value={session} />
          {!!state?.accounts.length && (
            <label>
              계정 등록
              <select
                name="client"
                defaultValue={state.active ?? ""}
                key={state.active}
              >
                {state.accounts.map((a) => (
                  <option key={a.client} value={a.client}>
                    {a.label} · {a.client.slice(-8)}
                  </option>
                ))}
                <option value="">다른 계정 추가</option>
              </select>
            </label>
          )}
          <button className="plan-login">Continue with ChatGPT</button>
        </form>
      ) : (
        <p>
          계정 추가·재승인은 전용 호스트의 브라우저에서 로컬 앱을 열어
          진행하세요.
        </p>
      )}
      {active && (
        <button
          onClick={() =>
            act(async () => {
              const r = await request("plan/disconnect", {});
              setNotice(
                r.confirmed
                  ? "ChatGPT 연결이 해제되었습니다."
                  : "로컬 연결을 해제했습니다. ChatGPT 설정에서 원격 해제를 확인하세요.",
              );
            })
          }
        >
          ChatGPT 연결 해제
        </button>
      )}
      <a
        href="https://chatgpt.com/settings/usage"
        target="_blank"
        rel="noreferrer"
      >
        ChatGPT 사용량 관리 ↗
      </a>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
