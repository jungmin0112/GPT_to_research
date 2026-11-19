import { z } from "zod";
import { Problem } from "@/server/database/backend";
import {
  startLogin,
  status,
  access,
  models,
  disconnect,
} from "@/server/integrations/chatgpt/oauth";
import { withVault } from "@/server/integrations/chatgpt/vault";
export async function planRoute(req: Request, route: string, host: string) {
  const post = req.method === "POST";
  if (route === "plan/status" && !post)
    return Response.json(await status(), {
      headers: { "Cache-Control": "no-store" },
    });
  if (route === "plan/login" && post) {
    const fields = await req.formData();
    const target = new URL("/", "http://" + host);
    const session = z.uuid().parse(fields.get("session"));
    target.searchParams.set("session", session);
    const client = z
      .string()
      .max(256)
      .parse(fields.get("client") ?? "");
    return new Response(null, {
      status: 303,
      headers: {
        Location: await startLogin(client || undefined, target.href),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  if (route === "plan/disconnect" && post)
    return Response.json(await disconnect());
  if (route === "plan/welcome" && post) {
    await withVault((v) => {
      const a = v.accounts.find((a) => a.client === v.active);
      if (a) a.welcomed = true;
    });
    return Response.json({ ok: true });
  }
  if (route === "plan/models") {
    const a = await access();
    const catalog = await models(a.token);
    if (!post)
      return Response.json(
        { catalog, selected: a.model },
        { headers: { "Cache-Control": "no-store" } },
      );
    const { model } = z.object({ model: z.string() }).parse(await req.json());
    if (!catalog.some((m) => m.id === model))
      throw new Problem(400, "이 계정의 모델 목록에서 선택하세요.");
    await withVault((v) => {
      const current = v.accounts.find((b) => b.client === a.client);
      if (!current || v.active !== a.client)
        throw new Problem(409, "계정이 변경되었습니다.");
      current.model = model;
    });
    return Response.json({ ok: true });
  }
  throw new Problem(404, "요청을 확인해 주세요.");
}
