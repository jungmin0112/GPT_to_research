import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "vitest";
import { check } from "../scripts/check-boundaries.mjs";

test("공개 경로, 내부 재수출 위반과 모듈 간 순환 검사", () => {
  const root = mkdtempSync(join(tmpdir(), "gts-boundary-"));
  try {
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { moduleResolution: "bundler", module: "esnext" },
      }),
    );
    for (const id of ["alpha", "beta"])
      mkdirSync(join(root, "src/modules", id), { recursive: true });
    const write = (id: string, source: string) =>
      writeFileSync(join(root, "src/modules", id + ".ts"), source);
    write("alpha/index", 'export {b} from "../beta";');
    write("beta/index", 'export {b} from "./inner";');
    write("beta/inner", "export const b=1;");
    expect(check(root)).toEqual([]);
    write("alpha/index", 'export {b} from "../beta/inner";');
    write("beta/inner", 'import "../alpha"; export const b=1;');
    expect(check(root).join("\n")).toMatch(/private modules\/beta\/inner/);
    expect(check(root).join("\n")).toMatch(/cycle:/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
