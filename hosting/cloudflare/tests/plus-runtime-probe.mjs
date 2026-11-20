// Isolated compatibility test. Build with fixture bindings and no plan credentials.
import { withVault } from "../../../src/server/integrations/chatgpt/vault.ts";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";

const marker = "fixture-marker";
const path = "/tmp/gts-marker";
const probe = {
  async fetch(request) {
    const route = new URL(request.url).pathname;
    if (
      request.method !== "GET" ||
      !["/capabilities", "/second-request"].includes(route)
    ) {
      return new Response(null, { status: 404 });
    }
    const results = {};
    if (route === "/capabilities") {
      try {
        await withVault((v) => {
          v.pending = marker;
        });
        results.vaultWritable = true;
      } catch (e) {
        results.vaultError = e.code || e.name;
      }
      try {
        await writeFile(path, marker);
        results.tmpWritable = true;
      } catch (e) {
        results.tmpError = e.code || e.name;
      }
      const server = createServer();
      try {
        await new Promise((resolve, reject) => {
          server.once("error", reject);
          server.listen(0, "127.0.0.1", resolve);
        });
        results.listenPortType = typeof server.address()?.port;
      } catch (e) {
        results.listenError = e.code || e.name;
      } finally {
        if (server.listening) server.close();
      }
    } else {
      try {
        results.vaultMarkerRetained = await withVault(
          (v) => v.pending === marker,
        );
      } catch (e) {
        results.vaultError = e.code || e.name;
      }
      try {
        results.tmpMarkerRetained = (await readFile(path, "utf8")) === marker;
      } catch (e) {
        results.tmpMarkerRetained = false;
        results.tmpError = e.code || e.name;
      }
    }
    return Response.json(results, { headers: { "Cache-Control": "no-store" } });
  },
};
export default probe;
