# 내부 API 계약 (구현 지침, 최종 URL은 코딩 시 확정)

## 공통 규약

- Next.js Route Handlers, 요청/응답 Zod 검증, 인증 필수, 서버에서 사용자·프로젝트·세션 소유권 확인.
- 오류 응답: `{ error: { code, message, retryable? } }`. 인증 실패 401, 권한 없음 403, 대상 없음 404, 검증 오류 400, 충돌 409, 비용/호출 제한 429.
- 웹 검색/문서 수집은 네트워크가 실패할 수 있으므로 비동기 상태와 재시도 제공. 브라우저에서 서비스 역할 키나 OpenAI 키 호출 금지.
- 상태 변경 API에는 적절한 `idempotency_key`를 적용해 새로고침·중복 클릭·Cron 중복으로 레코드가 중복되지 않게 한다.

## 기능별 Route Handler 초안

| 메서드/경로 | 책임 | 주요 요청 및 결과 |
|---|---|---|
| `GET/POST /api/projects` | 목록/생성 | 프로젝트 이름·목적 -> project ID |
| `GET/PATCH /api/projects/:projectId` | 조회/수정 | 소유권 검사, 정책/이름 |
| `GET/POST /api/projects/:projectId/sessions` | 프로젝트 세션 목록/분기 | parent_session_id?, origin_message_id?, source_id?, `reference_policy` -> session |
| `GET /api/sessions/:id` | 세션 상태 및 대화 | 세션 정보·메시지 페이징·workspace |
| `PATCH /api/sessions/:id` | 제목/상태/참조·모델 설정 | `reference_policy`, override, status |
| `POST /api/sessions/:id/chat` | 채팅 스트림 | `text`, `client_message_id`, `explicit_ref?`, `search_mode` -> SSE 이벤트 + 저장된 assistant message |
| `POST /api/sessions/:id/branch` | 심화 분기 생성 | 출발 메시지/자료·시작 질문·참조 범위 -> 새 session |
| `GET/POST /api/projects/:id/sources` | 자료 목록/URL·텍스트 등록 | 링크/텍스트 -> source + 추출 상태 |
| `POST /api/sources/upload` | PDF 업로드 | 제한된 파일 -> private Storage + source metadata |
| `GET /api/sources/:id` | 원문·추출 상태 | 메타데이터, 추출 텍스트/페이지 및 locator |
| `POST /api/readings/:id/finish` | '다 읽음' 정리 | 원문 미니 Q&A 분석 작업 생성 -> review payload |
| `POST /api/readings/:id/transfer` | 사용자 선택 전달 | 후보 ID/키워드/선택적 코멘트 -> 메인 세션 참조 레코드 |
| `GET /api/projects/:id/graph` | 세션/결과물 그래프 | type, filters, groups, depth -> nodes/edges |
| `GET /api/projects/:id/knowledge` | 프로젝트 지식 검색 | pagination/filter/query |
| `GET/PATCH /api/knowledge/:id` | 통합 지식 상세/수정 | 본문/출처/점유율/이력; 수정 시 revision 검사 |
| `POST /api/knowledge/:id/reorganize` | 사용자 재분류·통합 해제 | 사용자의 선택된 기록 ID를 별개 노드로 재배치 |
| `GET/PUT /api/sessions/:id/workspace` | 탭·분할·스크롤·초안 | 세션별 UI 저장/복원 |
| `POST /api/updates/run` | 수동 갱신 | 요청 중복 방지, job ID 및 상태 |
| `GET /api/updates/status` | 갱신 예정·진행 상태 | last/next, pending, job status |
| `GET/POST /api/conflicts/:id` | 상세 검토·사용자 해결 | single shared review + resolution |
| `GET /api/notifications` | 알림 | 미해결 충돌/실패 |
| `GET /api/export` | MD/PDF 내보내기 | project/node IDs + format, 원문 출처 포함 |
| `GET /api/search` | 통합 검색 | project, types, query |

여기서 `:id`는 실제 Next.js 동적 라우트 `[id]`로 구현한다. 프레임워크의 지원 메서드/환경에 따라 REST 형태를 합리적으로 변경할 수 있지만 **사용자 기능은 유지**해야 한다.

## Chat 스트림 이벤트 최소 계약

`event: message.started` -> `{userMessageId}`

`event: text.delta` -> `{text}`

`event: reference.added` -> `{refKind, refId?, url?, title?, locator?}`

`event: search.status` -> `{phase, status}`

`event: message.completed` -> `{assistantMessageId, usage?, responseId?}`

`event: error` -> `{code, message, retryable}`

**단일 실패가 원본 사용자 메시지를 유실시켜서는 안 된다.** 미완성 답변 상태를 메시지에 저장하고 UI에 표시한다.

## `explicit_ref` 구조

```json
{
  "kind": "source_or_knowledge",
  "id": "validated-uuid",
  "locator": { "page": 3, "paragraph": "p12" }
}
```

표시 프롬프트에는 사람이 읽을 경로와 제목이 들어가지만, 진짜 참조 대상은 **소유권 검증된 ID**이다. 마지막으로 활성화된 중앙 분할 자료 1개만 선택 가능(A안). 질문 버튼은 입력창에 템플릿을 채우며, 실제 서버 참조는 사용자가 전송할 때 요청에 포함한다.

## 갱신 작업 계약

1. Cron(`*/1 * * * *` 또는 동등한 1분 확인) -> DB에 `due`가 있는지 확인 -> 작업자 호출.
2. 작업자에서 `update_jobs` 레코드를 lease 획득 후 수행, 작업 대상 세션을 `priority_score` 순으로 결정.
3. 미분석 메시지/기록만 추출, 유효성 있는 JSON 결과 수신, DB 트랜잭션 및 revision 검사 후 반영.
4. 충돌 발견 시 검토 기록/알림을 생성하고 정상 구간은 갱신.
5. 실패 시 lease 만료·재시도·사용자 상태 표시.

## 성능/보안 기준

- 검색 자동 아카이브는 서버 측의 품질 점수·호스트 접근 제한·중복 방지·일일 수집량 제한으로 과다 수집 회피.
- 외부 URL 수집 시 사설 IP/localhost/메타데이터 엔드포인트 차단, 리다이렉트 재검증, 최대 크기/시간/콘텐츠 타입 제한.
- MD/PDF 내보내기의 파일명 및 텍스트는 안전하게 정화. 외부 HTML 스크립트 실행 금지.
