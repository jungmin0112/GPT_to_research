import { test, expect } from "@playwright/test";
test("로그인, 프로젝트 생성, 메인 세션 복원, 재로그인", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/projects")).status()).toBe(401);
  await page.goto("/");
  await page.getByRole("button", { name: "테스트 계정 로그인" }).click();
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByLabel("프로젝트 이름").fill("강수량 연구");
  await page.getByLabel("연구 목적").fill("계절별 차이 조사");
  await page.getByRole("button", { name: "생성하고 열기" }).click();
  await expect(page.getByRole("heading", { name: "메인 세션" })).toBeVisible();
  const sessionUrl = page.url();
  await page.reload();
  await expect(page.getByText("계절별 차이 조사")).toBeVisible();
  expect(page.url()).toBe(sessionUrl);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.getByRole("button", { name: "테스트 계정 로그인" }).click();
  await page.getByRole("button", { name: /강수량 연구/ }).click();
  await expect(page).toHaveURL(sessionUrl);
});
test("질문과 검색 인용이 스트리밍 후 복원된다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "테스트 계정 로그인" }).click();
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByLabel("프로젝트 이름").fill("자료 조사");
  await page.getByRole("button", { name: "생성하고 열기" }).click();
  await page.getByLabel("질문", { exact: true }).fill("강수량을 조사해 줘");
  await page.getByLabel("웹 검색").selectOption("required");
  await page.getByRole("button", { name: "전송" }).click();
  await expect(page.getByRole("link", { name: /테스트용 출처/ })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("테스트 응답입니다. 강수량을 조사해 줘"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /테스트용 출처/ }),
  ).toHaveAttribute("href", "https://example.org/");
});
