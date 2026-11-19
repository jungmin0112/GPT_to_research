// Sites preview supplies Vite-style flags. Keep Next on the local loopback.
import { createRequire } from "node:module";
const args = process.argv.slice(2);
const host = args.indexOf("--host");
if (host >= 0 && args[host + 1] !== "127.0.0.1")
  throw Error("로컬 미리보기는 127.0.0.1에서 실행하세요.");
if (host >= 0) args.splice(host, 2);
const require = createRequire(import.meta.url);
const cli = require.resolve("next/dist/bin/next");
process.argv = [
  process.execPath,
  cli,
  "dev",
  "--webpack",
  "-H",
  "127.0.0.1",
  ...args.filter((arg) => arg !== "--strictPort"),
];
require(cli);
