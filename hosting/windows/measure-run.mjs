// Invoked only by measure.ps1. Use the scratch copy's pinned dependencies.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const [root, scratch, port] = process.argv.slice(2);
const requireScratch = createRequire(path.join(scratch, "package.json"));
const origin = "http://127.0.0.1:" + port;
const statusFile = path.join(scratch, "measure-phase.json");
const cookies = new Map();
let step = "startup";
let project;
let httpStatus;
let server;
let evidence;

// Do not send request bodies, response bodies, cookies or provider errors to disk.
async function request(route, body) {
  const response = await fetch(origin + "/api/" + route, {
    method: body === undefined ? "GET" : "POST",
    redirect: "error",
    signal: AbortSignal.timeout(240_000),
    headers: {
      origin,
      "content-type": "application/json",
      cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";", 1)[0];
    const separator = pair.indexOf("=");
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  if (!response.ok) {
    httpStatus = response.status;
    throw Error();
  }
  return response.json();
}

async function phase(name) {
  step = name;
  const temp = statusFile + ".tmp";
  await writeFile(temp, JSON.stringify({ name }));
  await rename(temp, statusFile);
  const end = Date.now() + 60_000;
  while (Date.now() < end) {
    const ack = await readFile(statusFile + ".ack", "utf8").catch(() => "");
    if (ack.trim() === name) return;
    await delay(50);
  }
  throw Error();
}

async function checkedChild(exe, args, env = process.env) {
  const cp = spawn(exe, args, { cwd: scratch, env, windowsHide: true, stdio: "ignore" });
  const [code] = await once(cp, "exit");
  if (code !== 0) throw Error();
}

async function main() {
  process.stdin.setEncoding("utf8");
  let stdin = "";
  for await (const chunk of process.stdin) stdin += chunk;
  const login = JSON.parse(stdin);
  stdin = "";
  // Refuse an occupied port before installing or changing any remote data.
  const probe = createServer();
  probe.listen({ port: Number(port), host: "127.0.0.1", exclusive: true });
  await once(probe, "listening");
  await new Promise((resolve) => probe.close(resolve));

  await phase("install");
  await checkedChild(process.env.ComSpec, ["/d", "/c", "npm.cmd ci --no-audit --no-fund"]);
  process.env.NODE_ENV = "production";
  requireScratch("@next/env").loadEnvConfig(root, false, { info() {}, error() {} });
  const cli = requireScratch.resolve("next/dist/bin/next");

  process.env.WINDOWS_PC_HOST = "1";
  await phase("build");
  await checkedChild(process.execPath, [cli, "build", "--webpack"]);
  await phase("startup");
  server = spawn(process.execPath, [cli, "start", "-H", "127.0.0.1", "-p", port], {
    cwd: scratch, windowsHide: true, stdio: "ignore",
  });
  let ready = false;
  for (let i = 0; i < 120 && server.exitCode === null; i++) {
    const mode = await request("mode").catch(() => null);
    if (mode?.mock === false) { ready = true; break; }
    await delay(500);
  }
  if (!ready) throw Error();
  httpStatus = undefined;

  await phase("idle");
  await delay(10_000);
  await phase("prepare");
  await request("login", login);
  const plan = await request("plan/status");
  if (!plan.accounts.some((a) => a.connected && a.client === plan.active)) {
    step = "connect-plus-in-local-settings";
    throw Error();
  }

  project = randomUUID();
  const prefix = "projects/" + project + "/";
  await request("projects", { id: project, name: "Windows benchmark " + project, purpose: "Isolated real Plus measurement" });
  const initial = await request(prefix + "knowledge");
  if (initial.pending !== 0 || initial.failed !== 0 || initial.nodes.length || initial.changes.length) throw Error();
  await phase("emptyQueue");
  await checkedChild(process.execPath, ["scripts/update-worker.mjs", "--once", "--project=" + project, "--expect-empty"], {
    ...process.env, WORKER_LOCAL_URL: origin, WORKER_OWNER_EMAIL: login.email, WORKER_OWNER_PASSWORD: login.password,
  });
  delete login.email;
  delete login.password;
  await phase("collect");
  const fact = "In the International System of Units (SI), the speed of light in vacuum is exactly 299792458 metres per second.";
  const source = await request(prefix + "materials", { kind: "text", title: "BIPM SI Brochure: speed of light", text: fact });
  const queued = await request(prefix + "knowledge");
  if (!source.id || queued.pending !== 1) throw Error();
  await phase("analysis");
  const update = await request(prefix + "updates", { manual: true });
  await phase("verify");
  const result = await request(prefix + "knowledge");
  const change = result.changes.find((c) => c.source_id === source.id && c.state === "applied" &&
    typeof c.quote === "string" && c.quote.trim() && fact.includes(c.quote) &&
    result.nodes.some((n) => n.project_id === project && n.id === c.node_id && n.body.trim()));
  if (update.processed !== 1 || result.pending !== 0 || result.failed !== 0 || !change) throw Error();
  evidence = { nodeId: change.node_id, sourceId: source.id, quote: change.quote };
}

try {
  await main();
} catch {
  process.exitCode = 1;
} finally {
  const failureStatus = httpStatus;
  if (cookies.size) await request("logout", {}).catch(() => {});
  server?.kill();
  await writeFile(path.join(scratch, "measure-result.json"), JSON.stringify({
    ok: !!evidence, project, evidenceVerified: !!evidence, evidence,
    failureStep: evidence ? undefined : step, httpStatus: failureStatus,
  }));
}
