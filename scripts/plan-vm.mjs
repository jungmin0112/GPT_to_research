// Run under the same OS user as the app. Standard output only carries acknowledgements.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { z } from "zod";
import { withVault } from "../src/server/integrations/chatgpt/vault.ts";

const accountSchema = z.object({
  client: z.string().min(1),
  sub: z.string().min(1),
  label: z.string(),
  tokens: z.object({
    access: z.string().min(1),
    refresh: z.string().min(1),
    id: z.string().optional(),
    scope: z.string(),
    expires: z.number(),
  }),
  model: z.string().optional(),
  welcomed: z.boolean().optional(),
});
const owner = process.env.OWNER_USER_ID,
  project = process.env.NEXT_PUBLIC_SUPABASE_URL;
const binding = createHash("sha256")
  .update([project, owner].join("|"))
  .digest("hex");
async function receive() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 131072) throw Error();
    chunks.push(chunk);
  }
  const packet = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (packet.binding !== binding) throw Error();
  const account = accountSchema.parse(packet.account);
  const fingerprint = createHash("sha256")
    .update(account.tokens.refresh)
    .digest("hex");
  await withVault((v) => {
    if (!v.vmReady || packet.host === v.host) throw Error();
    if (
      v.lastImport === fingerprint &&
      v.accounts.some((a) => a.client === account.client && a.tokens)
    )
      return;
    if (
      v.accounts.some(
        (a) =>
          a.client === account.client && (a.tokens || a.sub !== account.sub),
      )
    )
      throw Error();
    v.accounts = v.accounts
      .filter((a) => a.client !== account.client)
      .concat(account);
    v.active = account.client;
    v.lastImport = fingerprint;
  });
}
async function move(destination) {
  if (
    !/^[A-Za-z0-9_][A-Za-z0-9_.-]*@[A-Za-z0-9][A-Za-z0-9.-]*$/.test(
      destination || "",
    )
  )
    throw Error();
  await withVault(async (v) => {
    const active = v.accounts.find((a) => a.client === v.active);
    const account = accountSchema.parse(active);
    const packet = JSON.stringify({ binding, host: v.host, account });
    await new Promise((resolve, reject) => {
      const ssh = spawn(
        "ssh",
        [
          "-T",
          "-o",
          "BatchMode=yes",
          "-o",
          "StrictHostKeyChecking=yes",
          "--",
          destination,
          "gts-import-plan",
        ],
        { stdio: ["pipe", "ignore", "inherit"], timeout: 30000 },
      );
      ssh.on("error", reject);
      ssh.stdin.on("error", reject);
      ssh.on("close", (code) => (code === 0 ? resolve() : reject(Error())));
      ssh.stdin.end(packet);
    });
    delete active.tokens;
  });
}
try {
  if (!owner || !project) throw Error();
  switch (process.argv[2]) {
    case "prepare":
      await withVault((v) => {
        v.vmReady = true;
      });
      break;
    case "receive":
      await receive();
      break;
    case "move":
      await move(process.argv[3]);
      break;
    default:
      throw Error();
  }
  console.log("완료");
} catch {
  console.error(
    "플랜 이전 실패. 호스트 준비, 소유자 설정, 활성 계정 및 SSH 연결을 확인하세요.",
  );
  process.exitCode = 1;
}
