import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { publicAddress, webUrl } from "../src/modules/sources/extraction";
test("공개 URL 주소와 포맷 제한", () => {
  for (const addr of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
  ])
    expect(publicAddress(addr)).toBe(false);
  expect(publicAddress("1.1.1.1")).toBe(true);
  expect(() => webUrl("file:///doc")).toThrow();
  expect(() => webUrl("https://name@example.com")).toThrow();
});
test("기존 답변 소급 등록, 출처 역할·중복·프로젝트 격리, PDF 객체 RLS", async () => {
  const db = new PGlite(),
    owner = crypto.randomUUID(),
    project = crypto.randomUUID(),
    other = crypto.randomUUID();
  try {
    await db.exec(
      await readFile("src/server/database/mock-bootstrap.sql", "utf8"),
    );
    await db.exec(await readFile("tests/fixtures/storage-schema.sql", "utf8"));
    const files = (await readdir("supabase/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort();
    const apply = async (file: string) =>
      db.exec(await readFile("supabase/migrations/" + file, "utf8"));
    for (const f of files.filter((n) => n.startsWith("20261118")))
      await apply(f);
    await db.query("insert into auth.users values($1),($2)", [owner, other]);
    await db.query("insert into app_owner(owner_id) values($1)", [owner]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    const [{ id: session }] = (
      await db.query<{ id: string }>("select create_project($1,'one','') id", [
        project,
      ])
    ).rows;
    const turn = crypto.randomUUID(),
      attempt = crypto.randomUUID();
    await db.query("select begin_turn($1,$2,$3,'q','required')", [
      session,
      turn,
      attempt,
    ]);
    const refs = [
      { kind: "candidate", url: "https://EXAMPLE.org:443" },
      { kind: "citation", url: "https://example.org/#p", title: "원문" },
      { kind: "candidate", url: "https://example.org/other" },
    ];
    await db.query("select finish_turn($1,'completed','body',$2)", [
      attempt,
      { references: refs },
    ]);
    // A chat-only installation lacks both original library RPCs.
    for (const statement of [
      "select * from list_materials($1,0)",
      "select * from claim_material($1,gen_random_uuid())",
    ]) {
      await expect(db.query(statement, [project])).rejects.toMatchObject({
        code: "42883",
      });
    }
    for (const f of files.filter((n) => n.startsWith("20261119")))
      await apply(f);
    const diagnosis = await db.query<{ status: string }>(
      await readFile("supabase/check-material-library.sql", "utf8"),
    );
    expect(diagnosis.rows.length).toBe(11);
    expect(diagnosis.rows.every((row) => row.status === "ready")).toBe(true);
    await db.exec("set role authenticated");
    const list = () =>
      db.query<{ id: string; cited: boolean; candidate: boolean }>(
        "select * from list_materials($1,0)",
        [project],
      );
    expect(
      (
        await db.query(
          "select * from search_materials($1,0,'example.org','url')",
          [project],
        )
      ).rows,
    ).toHaveLength(2);
    expect(
      (
        await db.query(
          "select * from search_materials($1,0,'example.org','pdf')",
          [project],
        )
      ).rows,
    ).toHaveLength(0);
    const rows = (await list()).rows;
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.candidate)).toHaveLength(2);
    expect(rows.filter((r) => r.cited)).toHaveLength(1);
    const ticket = crypto.randomUUID();
    const [job] = (
      await db.query<{ id: string }>("select * from claim_material($1,$2)", [
        project,
        ticket,
      ])
    ).rows;
    expect(job.id).toBe(rows.find((r) => r.cited)?.id);
    await db.query("select finish_material($1,$2,$3,'','수집 본문','')", [
      project,
      job.id,
      ticket,
    ]);
    expect(
      (
        await db.query("select body from read_material($1,$2)", [
          project,
          job.id,
        ])
      ).rows,
    ).toEqual([{ body: "수집 본문" }]);
    const key = owner + "/" + project + "/" + "a".repeat(64) + ".pdf";
    await db.query("insert into storage.objects values('research-files',$1)", [
      key,
    ]);
    expect((await db.query("select from storage.objects")).rows).toHaveLength(
      1,
    );
    await expect(
      db.query("insert into storage.objects values('research-files',$1)", [
        key.replace(project, other),
      ]),
    ).rejects.toThrow();
    expect(
      (await db.query("select * from read_material($1,$2)", [other, job.id]))
        .rows,
    ).toHaveLength(0);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      other,
    ]);
    expect((await list()).rows).toHaveLength(0);
    expect((await db.query("select from storage.objects")).rows).toHaveLength(
      0,
    );
  } finally {
    await db.close();
  }
});
