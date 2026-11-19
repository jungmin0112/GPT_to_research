import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
for (const width of [1440, 900]) {
  test(
    "검색·갱신·그래프·충돌 검토·출력·명시 참조 " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.getByRole("button", { name: "테스트 계정 로그인" }).click();
      await page.getByRole("button", { name: "새 프로젝트" }).click();
      const title = "통합 검증 " + width;
      await page.getByLabel("프로젝트 이름").fill(title);
      await page.getByRole("button", { name: "생성하고 열기" }).click();
      await expect(page.getByLabel("질문", { exact: true })).toBeVisible();
      const projects = await (await page.request.get("/api/projects")).json();
      const project = projects.find((p: { name: string }) => p.name === title);
      const api = "/api/projects/" + project.id;
      const add = async (text: string) =>
        expect(
          (
            await page.request.post(api + "/materials", {
              data: { kind: "text", title: "관측 지표", text },
            })
          ).ok(),
        ).toBe(true);
      await add("관측값이 증가했다.");
      await page.getByText("연구 갱신", { exact: true }).click();
      await page.getByRole("button", { name: "수동 갱신" }).click();
      await expect(page.getByText(/1건 처리/)).toBeVisible();
      await add("관측값이 감소했다.");
      await page.getByRole("button", { name: "수동 갱신" }).click();
      await page.getByRole("button", { name: "충돌 검토 1건" }).click();
      await expect(
        page.getByText("관측값이 증가했다.", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("승인할 본문").fill("검토 후 감소로 확인했다.");
      await page.getByRole("button", { name: "수정안 승인" }).click();
      await expect(page.getByText("검토할 충돌이 없습니다.")).toBeVisible();
      await page.getByRole("button", { name: "프로젝트 메뉴" }).click();
      await page
        .getByRole("button", { name: "통합 검색", exact: true })
        .click();
      await page.getByLabel("통합 검색").fill("관측 지표");
      await page
        .locator("article")
        .filter({ has: page.getByText(title, { exact: true }) })
        .getByRole("button", { name: "결과물 · 관측 지표" })
        .click();
      const detail = page.getByRole("region", { name: "결과물 상세" });
      await expect(detail.locator(".material-body")).toHaveText(
        "검토 후 감소로 확인했다.",
      );
      for (const [button, token] of [
        ["Markdown 다운로드", "근거 및 출처"],
        ["PDF 다운로드", "%PDF-1.4"],
      ]) {
        const dl = page.waitForEvent("download");
        await detail.getByRole("button", { name: button }).click();
        const f = await (await dl).path();
        expect((await readFile(f!)).includes(Buffer.from(token))).toBe(true);
      }
      await page.getByRole("button", { name: "현재 자료로 질문하기" }).click();
      await page
        .getByLabel("질문", { exact: true })
        .fill("지표를 설명해 주세요");
      const post = page.waitForRequest(
        (r) => r.method() === "POST" && r.url().endsWith("/chat"),
      );
      await page.getByRole("button", { name: "전송" }).click();
      expect((await post).postDataJSON().explicit_node).toBeTruthy();
      await expect(
        page.getByRole("button", { name: "첨부 자료 열기 · 관측 지표" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "보조 패널", exact: true })
        .click();
      await page.getByRole("button", { name: "결과물 그래프" }).click();
      await page.getByRole("button", { name: "◉ 관측 지표" }).click();
      await page.getByRole("button", { name: "결과물 열기" }).click();
      await expect(detail).toBeVisible();
    },
  );
}
