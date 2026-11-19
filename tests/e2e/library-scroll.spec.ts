import { test, expect, type Locator } from "@playwright/test";
test.use({ hasTouch: true });
test("직접 첨부·재사용·메시지 복원과 PC 휠 및 태블릿 터치 스크롤 격리", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 850 });
  await page.goto("/");
  await page.getByRole("button", { name: "테스트 계정 로그인" }).click();
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByLabel("프로젝트 이름").fill("스크롤 연구");
  await page.getByLabel("연구 목적").fill("오랜 기록과 문서 비교 ".repeat(150));
  await page.getByRole("button", { name: "생성하고 열기" }).click();
  const attach = page.getByRole("button", { name: "자료 첨부", exact: true });
  await attach.click();
  const picker = page.getByRole("dialog", { name: "자료 첨부" });
  await picker.getByText("새 자료 첨부", { exact: true }).click();
  await picker.getByLabel("자료 유형", { exact: true }).selectOption("text");
  await picker.getByLabel("자료 제목").fill("관찰 일지");
  await picker
    .getByLabel("붙여넣을 본문")
    .fill("긴 원문 자료 한 줄\n".repeat(400));
  await picker.getByRole("button", { name: "자료 등록", exact: true }).click();
  const input = page.getByLabel("질문", { exact: true });
  await input.fill("자료 검토\n".repeat(200));
  await input.press("Enter");
  const link = page.getByRole("button", { name: "첨부 자료 열기 · 관찰 일지" });
  await expect(link).toBeVisible();
  await attach.click();
  await picker.getByLabel("제목·출처 검색").fill("관찰");
  await picker.getByLabel("자료 유형 필터").selectOption("pdf");
  await expect(picker.getByText("일치하는 자료가 없습니다.")).toBeVisible();
  await picker.getByLabel("자료 유형 필터").selectOption("text");
  await picker.getByRole("button", { name: "관찰 일지" }).click();
  await input.fill("재사용");
  await input.press("Enter");
  await expect(link).toHaveCount(2);
  await page.reload();
  await link.last().click();
  await expect(page.getByRole("heading", { name: "관찰 일지" })).toBeVisible();
  await page.getByRole("button", { name: "보조 패널", exact: true }).click();
  await page.getByRole("button", { name: "세션 그래프", exact: true }).click();
  await page.getByRole("button", { name: /◉ 메인 세션/ }).click();
  const scrollers = [".transcript", ".reader-scroll", ".aux-scroll"];
  const positions = () =>
    page.evaluate(
      (s) => s.map((sel) => document.querySelector(sel)!.scrollTop),
      scrollers,
    );
  const client = await page.context().newCDPSession(page);
  async function gesture(l: Locator, touch: boolean) {
    const b = (await l.boundingBox())!;
    const x = b.x + Math.min(35, b.width / 2),
      y = b.y + b.height * 0.7;
    if (touch) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let i = 1; i <= 8; i++)
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y - i * 12 }],
        });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, 220);
    }
  }
  for (const width of [1440, 900]) {
    await page.setViewportSize({ width, height: 850 });
    for (const [i, selector] of scrollers.entries()) {
      // Reset each independent pane to its initial edge before real input.
      await page.evaluate(
        (s) => s.forEach((sel) => (document.querySelector(sel)!.scrollTop = 0)),
        scrollers,
      );
      await gesture(page.locator(selector), width === 900);
      await expect.poll(async () => (await positions())[i]).toBeGreaterThan(0);
      expect((await positions()).filter((_, j) => j !== i)).toEqual([0, 0]);
      const el = page.locator(selector);
      await el.evaluate((n) => (n.scrollTop = n.scrollHeight));
      await gesture(el, width === 900);
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      expect((await positions()).filter((_, j) => j !== i)).toEqual([0, 0]);
      expect(
        await page.evaluate(() => [
          window.scrollY,
          document.querySelector("main")!.scrollTop,
        ]),
      ).toEqual([0, 0]);
      await expect(input).toBeInViewport();
      await expect(page.locator("header")).toBeInViewport();
    }
  }
  await page.getByRole("button", { name: "보조 패널", exact: true }).click();
  await page.getByRole("button", { name: "원문 확장" }).click();
  await expect(page.locator(".reader-scroll")).toBeInViewport();
  await expect(input).toBeHidden();
  await page.getByRole("button", { name: "대화와 함께 보기" }).click();
  await expect(input).toBeInViewport();
});

test("계정 관리는 설정에, 모델 선택은 입력창에 표시", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "테스트 계정 로그인" }).click();
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByLabel("프로젝트 이름").fill("모델 설정 검증");
  await page.getByRole("button", { name: "생성하고 열기" }).click();
  await expect(page.getByLabel("질문", { exact: true })).toBeVisible();
  await page.route("**/api/mode", (r) => r.fulfill({ json: { mock: false } }));
  await page.route("**/api/plan/status", (r) =>
    r.fulfill({
      json: {
        active: "fixture",
        accounts: [{ client: "fixture", connected: true, label: "검증 계정" }],
      },
    }),
  );
  await page.route("**/api/plan/models", (r) =>
    r.fulfill({
      json: {
        selected: "test",
        catalog: [{ id: "test", name: "테스트 모델" }],
      },
    }),
  );
  await page.reload();
  await expect(page.getByLabel("플랜 모델")).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Continue with ChatGPT" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "프로젝트 메뉴" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "설정", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue with ChatGPT" }),
  ).toBeInViewport();
  await expect(page.getByLabel("플랜 모델")).toBeHidden();
});
