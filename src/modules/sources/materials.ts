import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  backend,
  Problem,
  mockMode,
  supabase,
} from "@/server/database/backend";
import type { Material } from "@/modules/sources/types";
import { listProjects } from "@/modules/projects/server";
import {
  collectUrl,
  CollectionError,
  maxBytes,
  pdfText,
  webUrl,
} from "./extraction";

async function readBytes(req: Request, limit: number) {
  if (Number(req.headers.get("content-length")) > limit)
    throw new Problem(413, "입력 크기 한도를 초과했습니다.");
  const reader = req.body?.getReader();
  if (!reader) throw new Problem(400, "입력이 비어 있습니다.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Problem(413, "입력 크기 한도를 초과했습니다.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function pdfObject(project: string, hash: string, bytes?: Buffer) {
  if (!/^[0-9a-f]{64}$/.test(hash))
    throw new Problem(400, "PDF 식별자가 잘못되었습니다.");
  if (mockMode()) {
    const dir = path.join(
      process.env.MOCK_DATA_DIR || ".mock-data",
      "pdf",
      project,
    );
    const file = path.join(dir, hash + ".pdf");
    if (!bytes) return readFile(file);
    await mkdir(dir, { recursive: true });
    const temp = file + "." + crypto.randomUUID();
    try {
      await writeFile(temp, bytes, { mode: 0o600, flag: "wx" });
      await rename(temp, file);
    } finally {
      await rm(temp, { force: true });
    }
  } else {
    const bucket = (await supabase()).storage.from("research-files");
    const key = process.env.OWNER_USER_ID + "/" + project + "/" + hash + ".pdf";
    if (!bytes) {
      const { data, error } = await bucket.download(key);
      if (error) throw new Problem(503, "PDF 파일을 열 수 없습니다.");
      return Buffer.from(await data.arrayBuffer());
    }
    const { error } = await bucket.upload(key, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (
      error &&
      !["409", "Duplicate", "ResourceAlreadyExists"].includes(
        String("statusCode" in error ? error.statusCode : ""),
      ) &&
      error.message !== "The resource already exists"
    )
      throw new Problem(
        503,
        "비공개 PDF 저장소에 업로드하지 못했습니다. Storage 정책과 연결을 확인하세요.",
      );
  }
}
export async function materials(
  req: Request,
  project: string,
  item: string | undefined,
  file: boolean,
  rpc: Awaited<ReturnType<typeof backend>>,
) {
  z.uuid().parse(project);
  if (!(await listProjects(rpc)).some((p) => p.id === project))
    throw new Problem(404, "프로젝트를 찾을 수 없습니다.");
  const params = new URL(req.url).searchParams;
  if (item === "collect" && !file && req.method === "POST") {
    const ticket = crypto.randomUUID();
    const [job] = (await rpc(
      "claim_material",
      { target: project, ticket },
      false,
    )) as { id: string; origin: string }[];
    if (!job) return Response.json({ id: null });
    let new_title = "",
      new_body = "",
      new_note = "";
    try {
      const result = await collectUrl(webUrl(job.origin));
      new_title = result.title;
      new_body = result.body;
    } catch (e) {
      new_note =
        e instanceof CollectionError
          ? e.message
          : "원문 서버 연결 실패 또는 시간 초과";
    }
    await rpc(
      "finish_material",
      { target: project, item: job.id, ticket, new_title, new_body, new_note },
      true,
    );
    return Response.json({ id: job.id });
  }
  if (item) {
    z.uuid().parse(item);
    if (req.method !== "GET")
      throw new Problem(405, "지원하지 않는 요청입니다.");
    const [row] = (await rpc(
      "read_material",
      { target: project, item },
      false,
    )) as Material[];
    if (!row) throw new Problem(404, "자료를 찾을 수 없습니다.");
    if (!file) return Response.json(row);
    if (row.kind !== "pdf") throw new Problem(404, "PDF 파일이 없습니다.");
    const bytes = await pdfObject(project, row.identity_key);
    return new Response(new Uint8Array(bytes!), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          "attachment; filename*=UTF-8''" + encodeURIComponent(row.origin),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (req.method === "GET")
    return Response.json(
      await rpc(
        "list_materials",
        {
          target: project,
          page_offset: z.coerce
            .number()
            .int()
            .min(0)
            .max(2147483647)
            .parse(params.get("offset") || 0),
        },
        false,
      ),
    );
  let source_kind: string,
    source_origin: string,
    source_title: string,
    source_body = "",
    pdf_hash = "",
    source_note = "",
    source_state = "ready";
  const save = () =>
    rpc(
      "save_material",
      {
        target: project,
        source_kind,
        source_title,
        source_origin,
        source_body,
        source_state,
        source_note,
        pdf_hash,
      },
      true,
    );
  if (req.headers.get("content-type") === "application/pdf") {
    source_kind = "pdf";
    source_origin = z.string().trim().min(1).max(500).parse(params.get("name"));
    source_title = source_origin;
    const bytes = await readBytes(req, maxBytes);
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-")))
      throw new Problem(400, "PDF 파일 형식을 확인하세요.");
    pdf_hash = createHash("sha256").update(bytes).digest("hex");
    source_state = "failed";
    source_note = "PDF 등록 미완료. 같은 파일로 다시 등록하세요.";
    await save();
    await pdfObject(project, pdf_hash, bytes);
    source_state = "ready";
    source_note = "";
    try {
      source_body = (await pdfText(bytes)).replaceAll("\u0000", "");
    } catch (e) {
      source_state = "failed";
      source_note = e instanceof CollectionError ? e.message : "PDF 추출 실패";
    }
  } else {
    const data = z
      .discriminatedUnion("kind", [
        z.object({
          kind: z.literal("text"),
          title: z.string().trim().min(1).max(500),
          text: z
            .string()
            .min(1)
            .max(750000)
            .refine((t) => !!t.trim() && !t.includes("\u0000")),
        }),
        z.object({
          kind: z.literal("url"),
          url: z.string().trim().min(1).max(16000),
        }),
      ])
      .parse(JSON.parse((await readBytes(req, 4 * 1024 * 1024)).toString()));
    source_kind = data.kind;
    if (data.kind === "text") {
      source_title = data.title;
      source_origin = "직접 입력";
      source_body = data.text;
    } else {
      let url: URL;
      try {
        url = webUrl(data.url);
      } catch {
        throw new Problem(400, "HTTP(S) 원문 주소를 입력하세요.");
      }
      source_origin = url.href;
      source_title = url.href;
      source_state = "link";
      await save();
      source_state = "ready";
      try {
        const article = await collectUrl(url);
        source_body = article.body;
        source_title = article.title;
      } catch (e) {
        source_state = "failed";
        source_note =
          e instanceof CollectionError
            ? e.message
            : "네트워크 오류 또는 시간 초과로 원문을 가져오지 못했습니다.";
      }
    }
  }
  const id = await save();
  return Response.json({ id });
}
