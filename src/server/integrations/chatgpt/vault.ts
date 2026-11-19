import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import lockfile from "proper-lockfile";

export type Tokens = {
  access: string;
  refresh?: string;
  id?: string;
  expires: number;
  scope: string;
};
export type Account = {
  client: string;
  sub: string;
  label: string;
  tokens?: Tokens;
  model?: string;
  welcomed?: boolean;
};
export type Vault = {
  host: string;
  active?: string;
  pending?: string;
  accounts: Account[];
};
function directory() {
  const owner = process.env.OWNER_USER_ID;
  if (!owner) throw Error("Supabase owner required");
  const binding = createHash("sha256")
    .update([process.env.NEXT_PUBLIC_SUPABASE_URL, owner].join("|"))
    .digest("hex");
  return join(
    process.env.LOCALAPPDATA || join(homedir(), ".config"),
    "GPT-to-search",
    binding,
  );
}
// On Windows the file holds only DPAPI CurrentUser ciphertext. Secrets travel
// over the child's stdin/stdout, never in PowerShell arguments or stderr logs.
async function protect(input: string, decrypt: boolean): Promise<string> {
  if (process.platform !== "win32") return input;
  const script =
    "Add-Type -AssemblyName System.Security; $ErrorActionPreference='Stop'; $s=[Console]::In.ReadToEnd();" +
    (decrypt
      ? "$b=[Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($s),$null,'CurrentUser'); [Console]::Write([Convert]::ToBase64String($b))"
      : "$b=[Security.Cryptography.ProtectedData]::Protect([Convert]::FromBase64String($s),$null,'CurrentUser'); [Console]::Write([Convert]::ToBase64String($b))");
  const result = await new Promise<string>((resolve, reject) => {
    const exe = join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const child = spawn(
      exe,
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, stdio: ["pipe", "pipe", "ignore"], timeout: 15000 },
    );
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("error", reject);
    child.stdin.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(Error("Windows 자격 증명 보호 오류")),
    );
    child.stdin.end(decrypt ? input : Buffer.from(input).toString("base64"));
  });
  return decrypt ? Buffer.from(result, "base64").toString("utf8") : result;
}
export async function withVault<T>(
  operation: (v: Vault) => Promise<T> | T,
): Promise<T> {
  const dir = directory();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const unlock = await lockfile.lock(dir, {
    retries: { retries: 20, minTimeout: 80, maxTimeout: 750 },
    stale: 60000,
  });
  try {
    const path = join(dir, "plan.account");
    let raw: string | undefined;
    try {
      raw = await readFile(path, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const plain = raw ? await protect(raw, true) : undefined;
    const v: Vault = plain
      ? JSON.parse(plain)
      : { host: "urn:uuid:" + randomUUID(), accounts: [] };
    const result = await operation(v);
    const next = JSON.stringify(v);
    if (next !== plain) {
      const tmp = path + "." + randomUUID();
      try {
        await writeFile(tmp, await protect(next, false), {
          mode: 0o600,
          flag: "wx",
        });
        await rename(tmp, path);
      } finally {
        await rm(tmp, { force: true });
      }
    }
    return result;
  } finally {
    await unlock();
  }
}
