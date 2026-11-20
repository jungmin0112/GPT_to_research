// Run after a production Next build. Embed only public browser assets.
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const target = process.argv[2];
if (!target) throw Error("Sites checkout path required");
const assets = {};
async function add(url, file, type) {
  assets[url] = [type, await readFile(file, "utf8")];
}
async function walk(path) {
  for (const f of await readdir(join(".next/static", path), {
    withFileTypes: true,
  })) {
    const p = join(path, f.name);
    if (f.isDirectory()) await walk(p);
    else if (/\.(js|css)$/.test(p))
      await add(
        "/_next/static/" + p.replaceAll("\\", "/"),
        join(".next/static", p),
        p.endsWith(".css") ? "text/css" : "application/javascript",
      );
  }
}
await walk("");
await add("/", ".next/server/app/index.html", "text/html; charset=utf-8");
// Same-account workers.dev HTTP requests require a service binding for API dispatch.
const mode = process.argv[3];
if (mode && mode !== "--workers-api-service")
  throw Error("Unknown API adapter");
const code =
  mode === "--workers-api-service"
    ? "function api(request, env) { return env.RESEARCH_API.fetch(request); }"
    : await readFile("hosting/sites/worker.mjs", "utf8");
const worker =
  code +
  "\nconst assets=" +
  JSON.stringify(assets) +
  `;
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path.startsWith("/api/"))return api(request,env);
  const entry=assets[path];
  if(!Array.isArray(entry)||!["GET","HEAD"].includes(request.method))return new Response(null,{status:404});
  return new Response(request.method==="HEAD"?null:entry[1],{headers:{"content-type":entry[0],"cache-control":path==="/"?"private, no-cache":"public, max-age=31536000, immutable","x-content-type-options":"nosniff"}});
}};
`;
await mkdir(join(target, "dist/server"), { recursive: true });
await writeFile(join(target, "dist/server/index.js"), worker);
