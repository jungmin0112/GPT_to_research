import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const root = "http://127.0.0.1:18818";
const child = spawn(
  process.env.WORKERD_BIN || "workerd",
  ["serve", fileURLToPath(new URL("./workerd.capnp", import.meta.url))],
  { stdio: ["ignore", "ignore", "inherit"] },
);
const exit = once(child, "exit");
try {
  let ready = false;
  for (let i = 0; i < 50 && !ready; i++) {
    if (child.exitCode !== null) throw Error("workerd failed");
    try {
      ready = (await fetch(root + "/api/mode")).ok;
    } catch {
      await delay(100);
    }
  }
  assert.ok(ready);
  assert.equal((await fetch(root + "/api/projects")).status, 401);
  const result = await fetch(root + "/api/login", {
    method: "POST",
    headers: { origin: root, "content-type": "application/json" },
    body: JSON.stringify({
      email: "test@example.invalid",
      password: "fixture",
    }),
  });
  assert.equal(result.status, 200);
  const jar = result.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  const list = await fetch(root + "/api/projects", {
    headers: { cookie: jar },
  });
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), [{ name: "research-test" }]);
  console.log("workerd login, two cookies, /user and authenticated RPC passed");
} finally {
  child.kill();
  await exit;
}
