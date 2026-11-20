import { PGlite } from "@electric-sql/pglite";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

test("재접속한 작업자는 대기 자료를 선점하고 만료된 작업을 중복 없이 반영한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-resume-"));
  const owner = crypto.randomUUID();
  const project = crypto.randomUUID();
  const interrupted = crypto.randomUUID();
  const resumed = crypto.randomUUID();
  let db = new PGlite(directory);
  async function signIn() {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
  }
  async function claim(ticket: string) {
    const result = await db.query<{ id: string; attempts: number }>(
      "select id,attempts from claim_knowledge($1,$2,false)",
      [project, ticket],
    );
    return result.rows;
  }
  async function apply(ticket: string) {
    const result = await db.query<{ outcome: string }>(
      "select commit_knowledge($1,$2,$3) outcome",
      [
        project,
        ticket,
        {
          action: "new",
          title: "기온",
          topic: "관측",
          body: "기온 상승",
          quote: "기온 상승",
          reason: "관측 기록",
        },
      ],
    );
    return result.rows[0].outcome;
  }
  try {
    await db.exec(
      await readFile("src/server/database/mock-bootstrap.sql", "utf8"),
    );
    await db.exec(await readFile("tests/fixtures/storage-schema.sql", "utf8"));
    const files = (await readdir("supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files)
      await db.exec(await readFile(join("supabase/migrations", file), "utf8"));
    await db.query("insert into auth.users values($1)", [owner]);
    await db.query("insert into app_owner(owner_id) values($1)", [owner]);
    await signIn();
    await db.query("select create_project($1,'연구','')", [project]);
    await db.query(
      "select save_material($1,'text','기온','직접','기온 상승','ready','',null)",
      [project],
    );

    // Move the fixture past the ten-minute automatic interval without sleeping.
    await db.exec("reset role");
    await db.exec(
      "update knowledge_events set created_at=now()-interval '1 hour'",
    );
    await db.close();
    db = new PGlite(directory);
    await signIn();
    const first = await claim(interrupted);
    expect(first).toHaveLength(1);
    expect(first[0].attempts).toBe(1);
    await db.close();

    db = new PGlite(directory);
    await signIn();
    expect(await claim(resumed)).toEqual([]);
    await db.exec("reset role");
    await db.exec(
      "update knowledge_events set leased_at=now()-interval '15 minutes'",
    );
    await db.exec(
      "update knowledge_attempts set started_at=now()-interval '15 minutes'",
    );
    await signIn();
    expect(await claim(resumed)).toEqual([{ id: first[0].id, attempts: 2 }]);
    expect(await apply(interrupted)).toBe("stale");
    expect(await apply(resumed)).toBe("created");
    expect(await apply(resumed)).toBe("stale");
    expect(
      (await db.query("select id from knowledge_changes")).rows,
    ).toHaveLength(1);
    expect((await db.query("select state from knowledge_events")).rows).toEqual(
      [{ state: "done" }],
    );
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
