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
  const apply = useCallback(
    async (data: State) => {
      setState(data);
      if (
        modelOnly &&
        data.accounts.find((a) => a.client === data.active)?.connected
      ) {
        const choices = await request("plan/models");
        setCatalog(choices.catalog);
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
