"use client";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
import { MaterialWorkspace } from "./session-workspace";
import { MiniReading, type Reading } from "@/modules/sessions";
import { SessionGraph } from "@/modules/graphs";
import { loadLocal, saveLocal } from "@/shared/lib/session-storage";
import { ApiError, request } from "@/shared/lib/request";
import { ProjectHome, type Project } from "@/modules/projects";

export default function Home() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [ready, setReady] = useState(false),
    [mock, setMock] = useState(false);
  const [active, setActive] = useState(""),
    [drawer, setDrawer] = useState(false);
  const [focus, setFocus] = useState(""),
    [reading, setReading] = useState<Reading | null>(null),
    [version, setVersion] = useState(0);
  const [screen, setScreen] = useState("chat");
  const [panel, setPanel] = useState("미니 세션");
  const [aux, setAux] = useState(false);
  const [dark, setDark] = useState(false);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);

  const project = projects?.find((p) => p.session_id === active);
  async function load() {
    const list: Project[] = await request("projects");
    setProjects(list);
    const session = new URLSearchParams(location.search).get("session");
    const view = new URLSearchParams(location.search).get("view");
    setScreen(view === "settings" || view === "library" ? view : "chat");
    setFocus(new URLSearchParams(location.search).get("focus") || "");
    setActive(list.find((p) => p.session_id === session)?.session_id || "");
    setAux(loadLocal("panel-open:" + session, false));
    setPanel(loadLocal("panel:" + session, "미니 세션"));
  }
  useEffect(() => {
    async function init() {
      try {
        setMock((await request("mode")).mock);
        await load();
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401))
          setError((e as Error).message);
      } finally {
        setReady(true);
      }
    }
    const theme = loadLocal<boolean>(
      "dark",
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    document.documentElement.dataset.theme = theme ? "dark" : "light";
    Promise.resolve().then(() => setDark(theme));
    void init();
  }, []);
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
  function navigate(next: string) {
    setScreen(next);
    setDrawer(false);
    const url = new URL(location.href);
    if (next === "chat") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    history.replaceState(null, "", url);
  }
  function branch(id: string) {
    const next = id === active ? "" : id;
    setFocus(next);
    setReading(null);
    navigate("chat");
    const u = new URL(location.href);
    u.searchParams.delete("material");
    if (next) u.searchParams.set("focus", next);
    else u.searchParams.delete("focus");
    history.replaceState(null, "", u);
  }
  function select(id: string) {
    setReading(null);
    setFocus("");
    navigate("chat");
    setActive(id);
    setAux(loadLocal("panel-open:" + id, false));
    setPanel(loadLocal("panel:" + id, "미니 세션"));

    setDrawer(false);
    if (id !== active || !id)
      history.replaceState(null, "", id ? "?session=" + id : "/");
  }
  useEffect(() => {
    if (!drawer) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [drawer]);
  const name = (
    <span className="brand">
      <span aria-hidden="true" className="mark">
        ⌕
      </span>{" "}
      GPT to search
    </span>
  );
  return (
    <>
      <header>
        {projects && (
          <button
            aria-expanded={drawer}
            aria-label="프로젝트 메뉴"
            onClick={() => setDrawer(!drawer)}
          >
            ☰
          </button>
        )}
        {name}
        <span className="mode">{mock ? "로컬 mock" : "연구 공간"}</span>
        <button
          aria-label={dark ? "라이트 모드" : "다크 모드"}
          onClick={() => {
            setDark(!dark);
            saveLocal("dark", !dark);
            document.documentElement.dataset.theme = dark ? "light" : "dark";
          }}
        >
          {dark ? "☀" : "☾"}
        </button>
        {project && (
          <button
            aria-expanded={aux}
            onClick={() => {
              setAux(!aux);
              saveLocal("panel-open:" + active, !aux);
            }}
          >
            보조 패널
          </button>
        )}
        {projects && (
          <button
            disabled={busy}
            onClick={() =>
              action(async () => {
                await request("logout", {});
                setProjects(null);
                select("");
              })
            }
          >
            로그아웃
          </button>
        )}
      </header>
      {error && <div role="alert">{error}</div>}
      {!ready ? (
        <main>불러오는 중…</main>
      ) : !projects ? (
        <main className="login card">
          <h1>연구 공간 로그인</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = Object.fromEntries(new FormData(e.currentTarget));
              void action(async () => {
                await request("login", data);
                await load();
              });
            }}
          >
            {mock ? (
              <p>이 기기에 저장되는 테스트 계정으로 시작합니다.</p>
            ) : (
              <>
                <label>
                  이메일
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  비밀번호
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
              </>
            )}
            <Button disabled={busy}>
              {mock ? "테스트 계정 로그인" : "로그인"}
            </Button>
          </form>
        </main>
      ) : (
        <div className="workspace">
          {drawer && (
            <button
              className="drawer-scrim"
              aria-label="메뉴 닫기"
              onClick={() => setDrawer(false)}
            />
          )}
          {drawer && (
            <nav aria-label="프로젝트 탐색">
              {project && (
                <>
                  <strong>{project.name}</strong>
                  <button onClick={() => branch(active)}>메인 세션</button>
                  <button onClick={() => navigate("library")}>자료함</button>
                  <button onClick={() => navigate("settings")}>설정</button>
                </>
              )}
              <Button variant="secondary" onClick={() => select("")}>
                프로젝트 홈
              </Button>
              {projects.map((p) => (
                <button key={p.id} onClick={() => select(p.session_id)}>
                  {p.name}
                </button>
              ))}
            </nav>
          )}
          <main>
            {!project ? (
              <ProjectHome
                projects={projects}
                onSelect={select}
                onCreated={async (id) => {
                  await load();
                  select(id);
                }}
              />
            ) : (
              <section className="session">
                <p className="eyebrow">{project.name}</p>
                <h1>
                  {screen === "library"
                    ? "프로젝트 자료함"
                    : screen === "settings"
                      ? "설정"
                      : focus
                        ? "심화 세션"
                        : "메인 세션"}
                </h1>
                <p>{project.purpose}</p>

                <MaterialWorkspace
                  key={focus || project.session_id}
                  name={project.name}
                  screen={screen}
                  onChat={() => navigate("chat")}
                  mock={mock}
                  project={project.id}
                  session={focus || project.session_id}
                  onBranch={branch}
                  chatRevision={version}
                  onRead={(doc) => {
                    setReading(doc);
                    setPanel("미니 세션");
                    setAux(true);
                  }}
                />
              </section>
            )}
          </main>
          {project && screen === "chat" && aux && (
            <aside>
              <h2>보조 패널</h2>
              <div className="tabs">
                {["미니 세션", "결과물 그래프", "세션 그래프"].map((t) => (
                  <button
                    key={t}
                    aria-pressed={panel === t}
                    onClick={() => {
                      setPanel(t);
                      saveLocal("panel:" + active, t);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="aux-scroll" aria-label="보조 패널 내용">
                {panel === "세션 그래프" ? (
                  <SessionGraph
                    project={project}
                    onOpen={(id) => {
                      select(id);
                      setAux(false);
                      saveLocal("panel-open:" + id, false);
                    }}
                  />
                ) : panel === "미니 세션" && reading ? (
                  <MiniReading
                    key={reading.id}
                    project={project.id}
                    doc={reading}
                    onForward={() => {
                      branch(active);
                      setVersion((v) => v + 1);
                      setAux(false);
                    }}
                  />
                ) : (
                  <p>
                    {panel === "미니 세션"
                      ? "원문에서 문단을 선택하거나 미니 세션을 여세요."
                      : panel === "결과물 그래프"
                        ? "등록된 결과물이 없습니다."
                        : project.name + " · 메인 세션"}
                  </p>
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </>
  );
}
