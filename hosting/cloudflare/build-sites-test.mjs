// Prepare a private test Site without changing the existing app's backend setting.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const folder = process.argv[2],
  origin = new URL(process.argv[3]);
if (
  !folder ||
  origin.protocol !== "https:" ||
  !origin.hostname.endsWith(".workers.dev") ||
  origin.origin !== process.argv[3]
)
  throw Error("Sites checkout and workers.dev origin required");
const gateway = await readFile(
  new URL("../sites/worker.mjs", import.meta.url),
  "utf8",
);
const worker =
  gateway +
  `\nconst origin=` +
  JSON.stringify(origin.origin) +
  `;
export default {async fetch(req){
 const path=new URL(req.url).pathname;
 if(req.method==="GET"&&(path==="/"||path==="/client.js"))return fetch(origin+path,{redirect:"manual"});
 return api(req,{RESEARCH_SERVER_ORIGIN:origin});
}};`;
await mkdir(resolve(folder, "dist/server"), { recursive: true });
await writeFile(resolve(folder, "dist/server/index.js"), worker);
