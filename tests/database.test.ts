import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { expect, test } from "vitest";
test("owner RLS, atomic project creation and idempotent main session", async () => {
  const db = new PGlite();
  const owner = crypto.randomUUID(),
    other = crypto.randomUUID(),
    project = crypto.randomUUID();
  try {
    await db.exec(
      await readFile("src/server/database/mock-bootstrap.sql", "utf8"),
    );
    for (const file of (await readdir("supabase/migrations")).sort()) {
      if (
        file.endsWith(".sql") &&
        !file.endsWith("_storage.sql") &&
        file !== "202611190003_source_turn.sql"
      )
        await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
    }
    await db.query("insert into auth.users values($1),($2)", [owner, other]);
    await db.query("insert into app_owner(owner_id) values($1)", [owner]);
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    const create = () =>
      db.query("select create_project($1,'연구','')", [project]);
    expect((await create()).rows).toEqual((await create()).rows);
    expect((await db.query("select * from project_list()")).rows).toHaveLength(
      1,
    );
    const target = (await db.query<{ id: string }>("select id from sessions"))
      .rows[0].id;
    const turn = crypto.randomUUID(),
      first = crypto.randomUUID(),
      second = crypto.randomUUID();
    const begin = async (attempt: string) =>
      (
        await db.query<{ state: string }>(
          "select begin_turn($1,$2,$3,'question','off') state",
          [target, turn, attempt],
        )
      ).rows[0].state;
    expect(await begin(first)).toBe("started");
    expect(await begin(second)).toBe("busy");
    await db.query("select finish_turn($1,'failed','partial','{}')", [first]);
    expect(await begin(second)).toBe("started");
    await db.query("select finish_turn($1,'completed','answer','{}')", [
      second,
    ]);
    expect(await begin(crypto.randomUUID())).toBe("completed");
    expect(
      (await db.query("select * from chat_history($1)", [target])).rows,
    ).toHaveLength(1);
    // Apply the workspace update over a populated previous-release schema.
    const evidence = await db.query<{ id: string }>(
      "select save_material($1,'text','기존 자료','직접 등록','본문','ready','',null) id",
      [project],
    );
    const snapshot = async () => ({
      projects: (await db.query("select * from project_list()")).rows,
      turns: (await db.query("select * from chat_history($1)", [target])).rows,
      source: (
        await db.query("select * from read_material($1,$2)", [
          project,
          evidence.rows[0].id,
        ])
      ).rows,
    });
    const before = await snapshot();
    await db.exec("reset role");
    await db.exec(
      await readFile(
        "supabase/migrations/202611190003_source_turn.sql",
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    expect(await snapshot()).toEqual(before);
    expect((await db.query("select * from chat_replies")).rows).toHaveLength(2);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      other,
    ]);
    expect(
      (await db.query("select * from chat_history($1)", [target])).rows,
    ).toHaveLength(0);
    expect(await begin(crypto.randomUUID())).toBe("missing");
    expect((await db.query("select * from project_list()")).rows).toHaveLength(
      0,
    );
    expect((await db.query("select * from sessions")).rows).toHaveLength(0);
    await expect(
      db.query("select create_project($1,'other','')", [crypto.randomUUID()]),
    ).rejects.toThrow();
    await db.exec("reset role; set role anon");
    await expect(db.query("select * from project_list()")).rejects.toThrow();
  } finally {
    await db.close();
  }
});
