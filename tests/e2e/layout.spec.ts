import { test, expect } from "@playwright/test";
test("세션 전환, 두 원문과 스크롤 복원, 단일 자료 명시 참조", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "테스트 계정 로그인" }).click();
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByLabel("프로젝트 이름").fill("작업 공간 검증");
  await page.getByRole("button", { name: "생성하고 열기" }).click();
  await page.getByText("프로젝트 자료함", { exact: true }).click();
  for (const title of ["자료 A", "자료 B"]) {
    await page.getByLabel("자료 유형").selectOption("text");
    await page.getByLabel("자료 제목").fill(title);
    await page
      .getByLabel("붙여넣을 본문")
      .fill((title + " 관측 기록\n").repeat(350));
    await page.getByRole("button", { name: "자료 등록", exact: true }).click();
    await expect(page.getByRole("tab", { name: title })).toBeVisible();
  }
  await page.getByRole("button", { name: "2분할" }).click();
  const readers = page.getByRole("region", { name: "자료 상세" });
  await expect(readers).toHaveCount(2);
  const reader = readers.filter({
    has: page.getByRole("heading", { name: "자료 A" }),
  });
  await page.getByRole("tab", { name: "자료 A" }).click();
  await page.getByRole("button", { name: "현재 자료로 질문하기" }).click();
  const input = page.getByLabel("질문", { exact: true });
  await expect(input).toHaveValue(/자료 A/);
  const url = page.url();
  const ref = new URL(url).searchParams.get("material");
  await input.fill("기록 요약");
  await input.press("Shift+Enter");
  await input.pressSequentially("A");
  await reader.evaluate((el) => (el.scrollTop = 200));
  await expect.poll(() => reader.evaluate((el) => el.scrollTop)).toBe(200);
  await page.getByRole("button", { name: "프로젝트 메뉴" }).click();
  await page.getByRole("button", { name: "프로젝트 홈", exact: true }).click();
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByLabel("프로젝트 이름").fill("독립 작업");
  await page.getByRole("button", { name: "생성하고 열기" }).click();
  await expect(input).toHaveValue("");
  await expect(readers).toHaveCount(0);
  await page.getByRole("button", { name: "프로젝트 메뉴" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "작업 공간 검증" })
    .click();
  await page.reload();
  await expect(readers).toHaveCount(2);
  await expect(input).toHaveValue("기록 요약\nA");
  await expect.poll(() => reader.evaluate((el) => el.scrollTop)).toBe(200);
  await page.getByRole("button", { name: "보조 패널", exact: true }).click();
  await page.getByRole("button", { name: "세션 그래프", exact: true }).click();
  await page.getByRole("button", { name: /◉ 메인 세션/ }).click();
  await expect(page).toHaveURL(url);
  await page.getByRole("button", { name: "세션 열기", exact: true }).click();
  await page.getByText("프로젝트 자료함", { exact: true }).click();
  if (await page.getByLabel("자료 유형").isVisible())
    await page.getByText("프로젝트 자료함", { exact: true }).click();
  await page.getByRole("button", { name: "다크 모드" }).click();
  await page.screenshot({
    animations: "disabled",
    path: info.outputPath("desktop.png"),
  });
  await page.setViewportSize({ width: 900, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(900);
  await page.screenshot({
    animations: "disabled",
    path: info.outputPath("tablet.png"),
  });
  const post = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/chat"),
  );
  await input.press("Enter");
  expect((await post).postDataJSON().explicit_ref).toBe(ref);
  await expect(input).toHaveValue("");
  const session = new URL(url).searchParams.get("session");
  const rows = await (
    await page.request.get("/api/sessions/" + session + "/chat")
  ).json();
  expect(rows.at(-1).metadata.explicit_ref).toBe(ref);
});
