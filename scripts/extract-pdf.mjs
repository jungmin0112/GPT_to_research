// Run the parser in a bounded child process, including on Windows.
import { getDocumentProxy } from "unpdf";
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
try {
  const doc = await getDocumentProxy(new Uint8Array(Buffer.concat(chunks)), {
    isEvalSupported: false,
  });
  if (doc.numPages > 400) throw Error("page limit");
  const pages = [];
  let size = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    const text = items
      .filter((i) => "str" in i)
      .map((i) => i.str + (i.hasEOL ? "\n" : " "))
      .join("")
      .trim();
    size += text.length;
    if (size > 750000) throw Error("text limit");
    pages.push(text);
    page.cleanup();
  }
  process.stdout.write(JSON.stringify(pages.join("\n\n").trim()));
} catch {
  process.exitCode = 1;
}
