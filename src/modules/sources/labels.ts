import type { MaterialRow } from "./types";
const states = {
  ready: "본문 확보",
  link: "링크 보관",
  failed: "본문 확보 실패",
};
export function labels(row: MaterialRow) {
  return [
    row.manual &&
      { url: "등록 URL", pdf: "업로드 PDF", text: "입력 텍스트" }[row.kind],
    row.cited && "답변 인용",
    row.candidate && "검색 후보",
    states[row.state],
  ]
    .filter(Boolean)
    .join(" · ");
}
