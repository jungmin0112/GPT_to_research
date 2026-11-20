import { test, expect } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";

test("one-shot resource measurement authenticates and polls only the empty benchmark project", async () => {
  const target = crypto.randomUUID();
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(req.url!);
    if (req.url === "/api/login") {
      res.setHeader("Set-Cookie", "fixture=ok; Path=/");
      res.end("{}");
    } else if (!req.headers.cookie) {
      res.writeHead(401).end("{}");
    } else if (req.url === "/api/projects") {
      res.end(JSON.stringify([{id: crypto.randomUUID()}, {id: target}]));
    } else {
      res.end('{"processed":0}');
    }
  });
  server.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw Error();
    await promisify(execFile)(process.execPath, [
      "scripts/update-worker.mjs", "--once", "--expect-empty", "--project=" + target,
    ], { env: { ...process.env, WORKER_LOCAL_URL: "http://127.0.0.1:" + address.port,
      WORKER_OWNER_EMAIL: "test@example.org", WORKER_OWNER_PASSWORD: "fixture" } });
    expect(requests).toEqual(["/api/projects", "/api/login", "/api/projects", "/api/projects/" + target + "/updates"]);
  } finally {
    server.close();
  }
});
