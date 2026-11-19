// Run against an already configured loopback app with a disposable Supabase owner.
import { chromium, expect } from "@playwright/test";
const url = new URL(process.env.LOCAL_APP_URL || "http://127.0.0.1:3000");
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw Error("Local test only");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
});
try {
  const page = await browser.newPage();
  await page.goto(url.href);
  await page.getByLabel("이메일").fill(process.env.TEST_OWNER_EMAIL);
  await page.getByLabel("비밀번호").fill(process.env.TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  const name = "연동 검사 " + crypto.randomUUID().slice(0, 8);
  await page.getByLabel("프로젝트 이름").fill(name);
  await page.getByRole("button", { name: "생성하고 열기" }).click();
  await expect(page.getByRole("heading", { name: "메인 세션" })).toBeVisible();
  const address = page.url();
  await page.reload();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByLabel("비밀번호")).toBeVisible();
  expect(
    (await page.request.get(new URL("/api/projects", url).href)).status(),
  ).toBe(401);
  await page.getByLabel("이메일").fill(process.env.TEST_OWNER_EMAIL);
  await page.getByLabel("비밀번호").fill(process.env.TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(address);
  console.log(
    "PASS email/password, create, refresh, sign out, sign in, reopen",
  );
  if (process.env.TEST_NO_MODEL === "1") {
    await page.getByLabel("질문", { exact: true }).fill("실패 복구 확인");
    await page.getByRole("button", { name: "전송" }).click();
    await page.getByRole("button", { name: "답변 재시도" }).click();
    await expect(
      page.getByRole("button", { name: "답변 재시도" }),
    ).toBeEnabled();
    await page.reload();
    await expect(page.getByText("실패 복구 확인", { exact: true })).toHaveCount(
      1,
    );
    await expect(
      page.getByRole("button", { name: "답변 재시도" }),
    ).toBeVisible();
    console.log("PASS missing-model error, retry and question persistence");
  }
} finally {
  await browser.close();
}
