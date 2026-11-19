import "server-only";
import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { execFile } from "node:child_process";
import path from "node:path";
import ipaddr from "ipaddr.js";
import robotsParser from "robots-parser";
import { loadBuffer } from "cheerio";

export const maxBytes = 8 * 1024 * 1024;
const agent = "GPTtoSearch";
export class CollectionError extends Error {}
function stop(text: string): never {
  throw new CollectionError(text);
}
export function webUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return stop("올바른 URL을 입력하세요.");
  }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    stop("인증 정보 없는 HTTP(S) 주소만 지원합니다.");
  return u;
}
export function publicAddress(address: string) {
  const ip = ipaddr.parse(address);
  return (
    ip.range() === "unicast" &&
    (ip.kind() === "ipv4" ||
      (ip as ipaddr.IPv6).match(ipaddr.IPv6.parse("2000::"), 3))
  );
}
export async function pdfText(bytes: Buffer) {
  const value = await new Promise<string>((resolve, reject) => {
    const child = execFile(
      process.execPath,
      ["--max-old-space-size=256", path.resolve("scripts/extract-pdf.mjs")],
      { timeout: 20000, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      (err, out) => {
        if (err)
          return reject(
            new CollectionError(
              "PDF 본문 추출 실패 (암호화·손상·처리 한도 확인)",
            ),
          );
        try {
          resolve(JSON.parse(out));
        } catch {
          reject(new CollectionError("PDF를 읽을 수 없습니다."));
        }
      },
    );
    child.stdin?.on("error", () => {});
    child.stdin?.end(bytes);
  });
  if (!value.trim())
    stop("추출할 텍스트가 없습니다. 스캔 PDF에는 OCR이 필요합니다.");
  return value;
}
async function download(u: URL, signal: AbortSignal, limit: number) {
  if (u.port) stop("표준 HTTP(S) 포트만 수집합니다.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const records = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (!records.length || records.some((r) => !publicAddress(r.address)))
    stop("공개 인터넷 주소만 수집합니다.");
  // Connect directly to the validated IP; retain the original host for TLS and HTTP.
  const get = u.protocol === "https:" ? https.get : http.get;
  const response = await new Promise<http.IncomingMessage>(
    (resolve, reject) => {
      get(
        {
          hostname: records[0].address,
          servername: isIP(host) ? undefined : host,
          headers: {
            host: u.host,
            "user-agent": agent,
            "accept-encoding": "identity",
          },
          path: u.pathname + u.search,
          agent: false,
          signal,
        },
        resolve,
      ).on("error", reject);
    },
  );
  try {
    const code = response.statusCode ?? 0;
    const chunks: Buffer[] = [];
    let size = 0;
    if (code === 200) {
      for await (const chunk of response) {
        size += chunk.length;
        if (size > limit) stop("원문 크기 한도를 초과했습니다.");
        chunks.push(chunk);
      }
    }
    return { code, headers: response.headers, bytes: Buffer.concat(chunks) };
  } finally {
    response.destroy();
  }
}
export async function collectUrl(start: URL) {
  let u = start;
  const signal = AbortSignal.timeout(14000);
  for (let hop = 0; hop < 5; hop++) {
    const robots = new URL("/robots.txt", u);
    let rulesUrl = robots,
      rules = await download(rulesUrl, signal, 512000);
    for (
      let i = 0;
      i < 4 &&
      [301, 302, 303, 307, 308].includes(rules.code) &&
      rules.headers.location;
      i++
    ) {
      rulesUrl = webUrl(new URL(rules.headers.location, rulesUrl).href);
      rules = await download(rulesUrl, signal, 512000);
    }
    if (rules.code !== 404 && rules.code !== 410 && rules.code !== 200)
      stop("사이트 수집 정책을 확인할 수 없습니다.");
    if (
      rules.code === 200 &&
      robotsParser(robots.href, rules.bytes.toString()).isAllowed(
        u.href,
        agent,
      ) === false
    )
      stop("사이트 수집 정책으로 본문을 보관할 수 없습니다.");
    const res = await download(u, signal, maxBytes);
    if ([301, 302, 303, 307, 308].includes(res.code) && res.headers.location) {
      u = webUrl(new URL(res.headers.location, u).href);
      continue;
    }
    if (res.code !== 200) stop("원문 요청 실패 (HTTP " + res.code + ")");
    const blocked = /(?:noarchive|nosnippet|none)/i;
    if (blocked.test(String(res.headers["x-robots-tag"] ?? "")))
      stop("사이트의 본문 보관 제한");
    const contentType = String(res.headers["content-type"] ?? "");
    const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1];
    const type = contentType.split(";")[0].trim().toLowerCase();
    let title = u.hostname,
      body = "";
    if (type === "application/pdf") {
      body = await pdfText(res.bytes);
    } else if (type === "text/plain")
      body = new TextDecoder(charset || "utf-8").decode(res.bytes);
    else if (type === "text/html" || type === "application/xhtml+xml") {
      const $ = loadBuffer(res.bytes, {
        encoding: { transportLayerEncodingLabel: charset },
      });
      if (
        $("meta[name]")
          .toArray()
          .some(
            (e) =>
              ["robots", agent.toLowerCase()].includes(
                ($(e).attr("name") ?? "").toLowerCase(),
              ) && blocked.test($(e).attr("content") ?? ""),
          )
      )
        stop("사이트의 본문 보관 제한");
      title = $("title").first().text().trim() || title;
      $(
        "script,style,iframe,noscript,nav,footer,header,form,template,[hidden]",
      ).remove();
      $("br").replaceWith("\n");
      $("p,li,div,section,h1,h2,h3,tr").append("\n");
      body = (
        $("article").first().length
          ? $("article").first()
          : $("main").first().length
            ? $("main").first()
            : $("body")
      )
        .text()
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n+/g, "\n\n")
        .trim();
    } else stop("지원하지 않는 원문 형식입니다.");
    if (!body.trim()) stop("확보한 본문이 없습니다.");
    if (body.length > 750000) stop("본문 길이 한도를 초과했습니다.");
    return { title: title.slice(0, 500), body: body.replaceAll("\u0000", "") };
  }
  return stop("리디렉션 한도를 초과했습니다.");
}
