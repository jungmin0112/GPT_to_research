import { test, expect, type Locator } from "@playwright/test";

test("스트리밍과 복원된 마크다운, 표 스크롤, 새 탭 원문 주소", async ({
  page,
  context,
}) => {
  const pdf =
    "https://example.org/paper.pdf?file=" +
    "research%2Farchive%2B".repeat(10) +
    "&signature=abc%3D%3D&part=2";
  const bare = "http://example.org/catalog?date=2026&lang=ko";
  const question = [
    "다음 자료",
    "",
    "## 연구 결과",
    "**핵심 발견**",
    "",
    "- 항목 하나",
    "- 항목 둘",
    "",
    "1. 첫 단계",
    "",
    "| 자료 | 관측값 |",
    "| --- | --- |",
    "| 표본 | " + "1234567890".repeat(12) + " |",
    "",
    "```js",
    "const value = 42;",
    "```",
    "",
    "[연구 보고서](" + pdf + ")",
    "",
    bare,
    "",
    "[메일](mailto:a@example.org) [상대](/private)",
  ].join("\n");
  // Hold the real terminal event so React cannot batch away the in-flight UI.
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const r = await original(...args);
      if (
        !r.headers.get("content-type")?.startsWith("text/event-stream") ||
        !r.body
      )
        return r;
      let buffer = "";
      const stream = r.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(
          new TransformStream<string, string>({
            async transform(chunk, controller) {
              buffer += chunk;
              let end;
              while ((end = buffer.indexOf("\n\n")) >= 0) {
                const event = buffer.slice(0, end + 2);
                buffer = buffer.slice(end + 2);
                if (event.startsWith("event: message.completed"))
                  await new Promise<void>((resolve) =>
                    window.addEventListener(
                      "release-completion",
                      () => resolve(),
                      { once: true },
                    ),
                  );
                controller.enqueue(event);
              }
            },
          }),
        )
        .pipeThrough(new TextEncoderStream());
      return new Response(stream, { headers: r.headers, status: r.status });
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "테스트 계정 로그인" }).click();
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByLabel("프로젝트 이름").fill("마크다운 검증");
  await page.getByRole("button", { name: "생성하고 열기" }).click();
  await page.getByLabel("질문", { exact: true }).fill(question);
  await page.getByLabel("웹 검색").selectOption("required");
  await page.getByRole("button", { name: "전송" }).click();

  async function verify(answer: Locator) {
    await expect(
      answer.getByRole("heading", { name: "연구 결과", level: 2 }),
    ).toBeVisible();
    await expect(answer.locator("strong")).toHaveText("핵심 발견");
    await expect(answer.locator("ul li")).toHaveCount(2);
    await expect(answer.locator("ol li")).toHaveText("첫 단계");
    await expect(answer.locator("pre code")).toContainText("const value = 42;");
    await expect(answer.locator("th")).toHaveCount(2);
    const table = answer.getByRole("region", { name: "답변 표" });
    expect(
      await table.evaluate((el) => {
        el.scrollLeft = 80;
        return el.scrollLeft;
      }),
    ).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      answer.getByRole("link", { name: "연구 보고서" }),
    ).toHaveAttribute("href", pdf);
    await expect(answer.getByRole("link", { name: bare })).toHaveAttribute(
      "href",
      bare,
    );
    await expect(answer.getByRole("link")).toHaveCount(2);
  }
  await verify(page.locator("article[aria-live] .answer-markdown"));
  await page.evaluate(() =>
    window.dispatchEvent(new Event("release-completion")),
  );
  const saved = page.locator("article:not([aria-live]) .answer-markdown");
  await verify(saved);
  await page.reload();
  await verify(saved);
  const id = new URL(page.url()).searchParams.get("session");
  const [turn] = await (
    await page.request.get("/api/sessions/" + id + "/chat")
  ).json();
  expect(turn.answer).toBe("테스트 응답입니다. " + question);
  expect(turn.metadata.references[0].url).toBe("https://example.org/");
  await context.route(/https?:\/\/example\.org\//, (r) =>
    r.fulfill({ contentType: "text/plain", body: "원문 테스트" }),
  );
  for (const [label, url] of [
    ["연구 보고서", pdf],
    [bare, bare],
    ["인용 · 테스트용 출처", "https://example.org/"],
  ]) {
    const popup = context.waitForEvent("page");
    await page.getByRole("link", { name: label, exact: true }).click();
    const tab = await popup;
    await expect(tab).toHaveURL(url);
    await tab.close();
  }
});
