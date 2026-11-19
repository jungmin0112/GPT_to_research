import { request } from "@/shared/lib/request";
import type { Material } from "./types";
export const materialPath = (project: string) =>
  "projects/" + project + "/materials";
export const readMaterial = (project: string, id: string): Promise<Material> =>
  request(materialPath(project) + "/" + id);
export const retryMaterial = (
  project: string,
  url: string,
): Promise<{ id: string }> =>
  request(materialPath(project), { kind: "url", url });
export async function registerMaterial(
  api: string,
  mode: "pdf" | "text" | "url",
  fields: FormData,
): Promise<{ id: string }> {
  if (mode === "pdf") {
    const file = fields.get("pdf") as File;
    if (file.size > 8 * 1024 * 1024)
      throw Error("8 MiB 이하의 PDF를 선택하세요.");
    const res = await fetch(
      "/api/" + api + "?name=" + encodeURIComponent(file.name),
      {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: file,
      },
    );
    const data = await res.json();
    if (!res.ok) throw Error(data.error?.message || "업로드에 실패했습니다.");
    return data;
  }
  return request(
    api,
    mode === "url"
      ? { kind: mode, url: fields.get("url") }
      : {
          kind: mode,
          title: fields.get("title"),
          text: fields.get("text"),
        },
  );
}
