import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("URL·PDF·텍스트, 추출 실패와 검색 출처를 프로젝트에서 다시 연다", async ({
  page,
}) => {
  async function library(register = false) {
    await expect(
      page.getByRole("heading", { name: "메인 세션", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "프로젝트 메뉴" }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "자료함", exact: true })
      .click();
    if (register)
      await page.getByText("자료 등록", { exact: true }).first().click();
  }
  await page.goto("/");
  await page.getByRole("button", { name: "테스트 계정 로그인" }).click();
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByLabel("프로젝트 이름").fill("보관 검증");
  await page.getByRole("button", { name: "생성하고 열기" }).click();

  const reader = page.getByRole("region", { name: "자료 상세" });
  const url = "http://papers.example.test/report?revision=2";
  await library(true);
  await page.getByLabel("원문 URL").fill(url);
  await page.getByRole("button", { name: "자료 등록", exact: true }).click();
  await expect(reader.getByText("월별 강수량 본문입니다.")).toBeVisible();
  await page.reload();
  await expect(reader.getByRole("link", { name: url })).toHaveAttribute(
    "href",
    url,
  );
  await library(true);
  await page.getByLabel("자료 유형", { exact: true }).selectOption("pdf");
  await page
    .getByLabel(/PDF 파일/)
    .setInputFiles("tests/fixtures/research.pdf");
  await page.getByRole("button", { name: "자료 등록", exact: true }).click();
  await expect(reader.getByText("Project archive PDF fixture.")).toBeVisible();
  await page.reload();
  const href = await reader
    .getByRole("link", { name: "원본 PDF 다운로드" })
    .getAttribute("href");
  expect(await (await page.request.get(href!)).body()).toEqual(
    await readFile("tests/fixtures/research.pdf"),
  );
  await library(true);
  await page.getByLabel("자료 유형", { exact: true }).selectOption("text");
  await page.getByLabel("자료 제목").fill("현장 노트");
  await page.getByLabel("붙여넣을 본문").fill("원본 첫 줄\n원본 둘째 줄");
  await page.getByRole("button", { name: "자료 등록", exact: true }).click();
  await expect(reader.getByText("원본 첫 줄 원본 둘째 줄")).toBeVisible();
  await page.reload();
  await expect(
    reader.getByRole("heading", { name: "현장 노트" }),
  ).toBeVisible();
  await library(true);
  await page.getByLabel("원문 URL").fill("http://papers.example.test/private");
  await page.getByRole("button", { name: "자료 등록", exact: true }).click();
  await expect(reader.getByText(/사이트 수집 정책/)).toBeVisible();
  await page.reload();
  await expect(
    reader.getByRole("link", { name: /papers.example.test\/private/ }),
  ).toBeVisible();
  for (const [title, body] of [
    ["강수량 보고서", "월별 강수량 본문입니다."],
    ["research.pdf", "Project archive PDF fixture."],
    ["현장 노트", "원본 첫 줄 원본 둘째 줄"],
  ]) {
    await library();
    await page.getByRole("button", { name: title, exact: true }).click();
    await expect(reader.getByText(body)).toBeVisible();
  }
  await page.getByLabel("질문", { exact: true }).fill("검색 테스트");
  await page.getByLabel("웹 검색").selectOption("required");
  await page.getByRole("button", { name: "전송" }).click();
  await expect(
    page.getByRole("link", { name: /인용 · 테스트용 출처/ }),
  ).toHaveAttribute("target", "_blank");
  await library();
  await expect(
    page.getByRole("button", { name: "테스트용 출처" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "테스트용 출처" }).click();
  await expect(reader.getByText(/답변 인용/)).toBeVisible();
});
