import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const demoUser = "00000000-0000-4000-8000-000000000001";
const globalDb = globalThis as typeof globalThis & {
  researchDb?: Promise<PGlite>;
};

async function openDb() {
  const directory = process.env.MOCK_DATA_DIR || ".mock-data";
  await mkdir(directory, { recursive: true });
  const db = new PGlite(directory);
  await db.transaction(async (tx) => {
    const { rows } = await tx.query(
      "select to_regclass('mock_migrations') as present",
    );
    if (!(rows[0] as { present: string | null }).present) {
      await tx.exec(
        await readFile("src/server/database/mock-bootstrap.sql", "utf8"),
      );
      await tx.query("insert into auth.users values($1)", [demoUser]);
    }
    for (const name of (await readdir("supabase/migrations")).sort()) {
      if (!name.endsWith(".sql") || name.endsWith("_storage.sql")) continue;
      if (
        (await tx.query("select from mock_migrations where name=$1", [name]))
          .rows.length
      )
        continue;
      await tx.exec(
        await readFile(path.join("supabase/migrations", name), "utf8"),
      );
      await tx.query("insert into mock_migrations values($1)", [name]);
    }
    await tx.query(
      "insert into app_owner(owner_id) values($1) on conflict do nothing",
      [demoUser],
    );
  });
  return db;
}
function database() {
  return (globalDb.researchDb ??= openDb());
}
function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function mockLogin() {
  const token = randomBytes(32).toString("hex");
  await (
    await database()
  ).query("insert into mock_logins values($1,now()+interval '1 day')", [
    digest(token),
  ]);
  return token;
}
export async function mockAuthenticated(token: string) {
  return (
    (
      await (
        await database()
      ).query(
        "select from mock_logins where token_hash=$1 and expires_at>now()",
        [digest(token)],
      )
    ).rows.length === 1
  );
}
export async function mockLogout(token: string) {
  await (
    await database()
  ).query("delete from mock_logins where token_hash=$1", [digest(token)]);
}
export async function mockRpc(
  name: string,
  args: Record<string, unknown>,
  scalar: boolean,
) {
  if (!/^[a-z_]+$/.test(name)) throw Error("invalid function");
  return (await database()).transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      demoUser,
    ]);
    const values = Object.values(args);
    const params = Object.keys(args)
      .map((key, i) => {
        if (!/^[a-z_]+$/.test(key)) throw Error("invalid argument");
        return key + " => $" + (i + 1);
      })
      .join(",");
    const { rows } = await tx.query<Record<string, unknown>>(
      "select * from public." + name + "(" + params + ")",
      values,
    );
    return scalar ? rows[0]?.[name] : rows;
  });
}
