import { projectsRoute } from "@/modules/projects/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  backend,
  login,
  logout,
  mockMode,
  Problem,
} from "@/server/database/backend";

async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const route = (await params).path.join("/");
    const material =
      /^projects\/([^/]+)\/materials(?:\/([^/]+)(\/file)?)?$/.exec(route);
    const post = req.method === "POST";
    const host = req.headers.get("host") || "";
    if (
      (mockMode() || route.startsWith("plan/") || route.endsWith("/chat")) &&
      !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
    )
      throw new Problem(403, "로컬 mock 전용입니다.");
    if (
      post &&
      ((req.headers.get("origin") &&
        new URL(req.headers.get("origin")!).host !== host) ||
        (route === "plan/login"
          ? req.headers.get("origin") !== "http://" + host ||
            !req.headers
              .get("content-type")
              ?.startsWith("application/x-www-form-urlencoded")
          : !(
              material && req.headers.get("content-type") === "application/pdf"
            ) &&
            !req.headers.get("content-type")?.startsWith("application/json")))
    )
      throw new Problem(403, "요청 출처를 확인해 주세요.");
    if (!post && route === "mode") return Response.json({ mock: mockMode() });
    if (post && route === "login") {
      const body = mockMode()
        ? { email: "", password: "" }
        : z
            .object({ email: z.email(), password: z.string().min(1).max(1024) })
            .parse(await req.json());
      await login(body.email, body.password);
      return Response.json({ ok: true });
    }
    const rpc = await backend();
    const explore = /^projects\/([^/]+)\/exploration$/.exec(route);
    if (explore)
      return await (
        await import("@/modules/sessions/server")
      ).exploration(req, explore[1], rpc);
    if (material)
      return await (
        await import("@/modules/sources/server")
      ).materials(req, material[1], material[2], !!material[3], rpc);
    if (route.startsWith("plan/")) {
      if (mockMode())
        throw new Problem(403, "mock 모드에서는 계정 연결이 비활성화됩니다.");
      return await (
        await import("@/modules/ai/server")
      ).planRoute(req, route, host);
    }
    if (post && route === "logout") {
      await logout();
      return Response.json({ ok: true });
    }
    const session = /^sessions\/([^/]+)\/chat$/.exec(route);
    if (session)
      return await (
        await import("@/modules/sessions/server")
      ).chat(req, session[1], rpc);
    if (route === "projects") return await projectsRoute(req, rpc);
    throw new Problem(404, "찾을 수 없습니다.");
  } catch (e) {
    const p =
      e instanceof Problem
        ? e
        : e instanceof z.ZodError || e instanceof SyntaxError
          ? new Problem(400, "입력 내용을 확인해 주세요.")
          : new Problem(503, "요청을 완료하지 못했습니다. 다시 시도해 주세요.");
    return Response.json(
      { error: { code: p.status, message: p.message } },
      { status: p.status },
    );
  }
}
export { handle as GET, handle as POST };
