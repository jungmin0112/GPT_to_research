// Only the Playwright server loads this transport fixture. Use the normal
// robots, address validation, HTML extraction and database path in the app.
import dns from "node:dns/promises";
import http from "node:http";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
const lookup = dns.lookup.bind(dns);
dns.lookup = (name, ...args) =>
  name === "papers.example.test"
    ? Promise.resolve([{ address: "93.184.216.34", family: 4 }])
    : lookup(name, ...args);
const get = http.get.bind(http);
http.get = (options, callback) => {
  if (options?.headers?.host !== "papers.example.test")
    return get(options, callback);
  if (options.hostname !== "93.184.216.34")
    throw Error("Public endpoint must be pinned");
  const robots = options.path === "/robots.txt";
  const stream = Readable.from([
    Buffer.from(
      robots
        ? "User-agent: *\nDisallow: /private"
        : "<html><meta charset=utf-8><title>강수량 보고서</title><article><p>월별 강수량 본문입니다.</p></article></html>",
    ),
  ]);
  stream.statusCode = 200;
  stream.headers = {
    "content-type": robots ? "text/plain" : "text/html; charset=utf-8",
  };
  queueMicrotask(() => callback(stream));
  return new EventEmitter();
};

syncBuiltinESMExports();
