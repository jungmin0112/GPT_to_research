import type { NodeRecord, Change } from "./types";
export function report(node: NodeRecord, changes: Change[]) {
  const cited = changes.filter(
    (c) => c.node_id === node.id && c.state === "applied",
  );
  return [
    "# " + node.title,
    node.topic + " · 버전 " + node.revision,
    node.body,
    "## 근거 및 출처",
    ...cited.map((c) =>
      [
        "- " + c.source_title + " (" + c.source_id + ")",
        "> " + c.quote,
        c.reason,
        c.origin.origin || "",
        ...(c.origin.references || [])
          .filter((r) => r.kind === "citation")
          .map((r) => r.title + " " + r.url),
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
}
function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[<>:"/\\|?*]/g, "_");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function exportMarkdown(node: NodeRecord, changes: Change[]) {
  download(
    new Blob([report(node, changes)], { type: "text/markdown;charset=utf-8" }),
    node.title + ".md",
  );
}
export function exportPdf(node: NodeRecord, changes: Change[]) {
  // Raster pages preserve Korean glyphs using the device font without an external font service.
  const canvas = document.createElement("canvas");
  canvas.width = 1240;
  canvas.height = 1754;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("PDF 페이지를 만들지 못했습니다.");
  const pages: Uint8Array[] = [];
  let y = 95;
  function reset() {
    ctx!.fillStyle = "#fff";
    ctx!.fillRect(0, 0, 1240, 1754);
    ctx!.fillStyle = "#161616";
    ctx!.font = "25px sans-serif";
    y = 95;
  }
  function flush() {
    const raw = atob(canvas.toDataURL("image/jpeg", 0.9).split(",")[1]);
    pages.push(Uint8Array.from(raw, (s) => s.charCodeAt(0)));
    reset();
  }
  function line(s: string) {
    if (y > 1660) flush();
    ctx!.fillText(s, 82, y);
    y += 39;
  }
  reset();
  for (const paragraph of report(node, changes).split("\n")) {
    let current = "";
    for (const ch of paragraph) {
      if (ctx.measureText(current + ch).width > 1076) {
        line(current);
        current = "";
      }
      current += ch;
    }
    line(current);
  }
  flush();
  const parts: BlobPart[] = [],
    offsets = [0];
  let pos = 0;
  function write(s: string | Uint8Array) {
    const bytes = typeof s === "string" ? new TextEncoder().encode(s) : s;
    parts.push(new Uint8Array(bytes).buffer);
    pos += bytes.length;
  }
  function obj(id: number, body: () => void) {
    offsets[id] = pos;
    write(id + " 0 obj\n");
    body();
    write("\nendobj\n");
  }
  write("%PDF-1.4\n");
  obj(1, () => write("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () =>
    write(
      "<< /Type /Pages /Count " +
        pages.length +
        " /Kids [" +
        pages.map((_, i) => 3 + i * 3 + " 0 R").join(" ") +
        "] >>",
    ),
  );
  pages.forEach((bytes, i) => {
    const id = 3 + i * 3;
    obj(id, () =>
      write(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /P " +
          (id + 1) +
          " 0 R >> >> /Contents " +
          (id + 2) +
          " 0 R >>",
      ),
    );
    obj(id + 1, () => {
      write(
        "<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
          bytes.length +
          " >>\nstream\n",
      );
      write(bytes);
      write("\nendstream");
    });
    const paint = "q 595 0 0 842 0 0 cm /P Do Q";
    obj(id + 2, () =>
      write(
        "<< /Length " + paint.length + " >>\nstream\n" + paint + "\nendstream",
      ),
    );
  });
  const xref = pos;
  write(
    "xref\n0 " +
      offsets.length +
      "\n0000000000 65535 f \n" +
      offsets
        .slice(1)
        .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
        .join("") +
      "trailer\n<< /Size " +
      offsets.length +
      " /Root 1 0 R >>\nstartxref\n" +
      xref +
      "\n%%EOF",
  );
  download(new Blob(parts, { type: "application/pdf" }), node.title + ".pdf");
}
