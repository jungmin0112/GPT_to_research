# AGENTS.md — GPT to search 개발 에이전트 지침

## 목표 및 우선순위

사용자가 확정한 개인용 연구 도구의 **통합형 MVP 전 기능**을 단계적으로 완성한다. 바이브 코딩이라도 원본의 안전한 보존, 출처 정확성, RLS, API 비용·컨텍스트 경계, 사용성을 우선한다. 기능을 임의로 누락하거나 축소하지 않는다.

우선순위 충돌 시: (1) 사용자 확정 결정 `docs/08_decisions.md`, (2) 기능 명세 `docs/01_requirements.md`, (3) 데이터 불변식 `docs/03_data_model.md`, (4) 아키텍처/UX/API 계약, (5) 구현 편의. 명세가 모순되면 기존 결정과 사용자 의도를 기준으로 가장 작은 변경을 선택하고 `docs/CHANGELOG.md`에 기록한다. **새로운 제품 의사결정이 필요한 경우에만** 질문한다. 자잘한 기술 선택은 합리적으로 판단한다.

## 반드시 지킬 규칙

1. 각 작업 시작 시 관련 문서만 읽는다. 완료 시 변경 코드, 테스트 결과, 잔여 위험을 짧게 보고한다.
2. 기능 단위의 작동하는 세로 단면(vertical slice)으로 개발한다. 하나의 거대한 프롬프트로 전체 앱을 생성하거나, 기능 명세 없이 단순 UI 목업만 완료로 주장하지 않는다.
3. Next.js App Router + TypeScript, Supabase PostgreSQL/Auth/Storage, React Flow, OpenAI Responses API 기본 아키텍처를 유지한다. 다른 시스템을 도입할 때는 근거와 비용을 문서화한다.
4. `OPENAI_API_KEY`, 서비스 역할 키 등은 서버 전용으로만 취급한다. 클라이언트, 로그, 저장소에 노출하지 않는다. 실제 키 요청은 환경 변수 설정 안내로 대체한다.
5. 사용자 데이터는 인증으로 보호하고 RLS를 적용한다. 단일 사용자 서비스라 해도 미인증 외부 호출을 허용하지 않는다. SSRF/원격 URL 스캔·업로드 제한/HTML 정화/프롬프트 인젝션을 고려한다.
6. 세션 원본 대화, 수집 자료의 출처, 연구 기록, 지식 수정 이력을 보존한다. **AI의 요약을 원본 기록으로 대체하지 않는다.**
7. 다른 프로젝트 결과물은 복사·병합하지 않는다. **프로젝트별 결과물을 독립 저장하고 참조 링크만 지원**한다.
8. 현재 세션 컨텍스트와 외부 기록 참조를 구분한다. 참조 슬라이더를 낮춰도 이미 진행한 대화는 초기화하지 않으며, 이후 추가로 가져오는 외부 자료의 범위를 바꾼다.
9. 원문 열람·결과물 열람 시 자동으로 매 메시지에 본문을 주입하지 않는다. '현재 자료로 질문하기' 버튼을 누른 뒤 사용자에게 편집 가능한 프롬프트를 넣고 **전송 때 명시적 노드 ID를 서버로 전달**한다.
10. 메인 탐구는 필요 시 AI 자율 웹 검색 허용. **미니 세션은 원문 우선, 외부 검색은 사용자가 요청했을 때만.** 새로운 심화 세션은 AI 제안 가능하나 실제 생성은 사용자 동작으로만.
11. 10분 기본 갱신 + 활동 가중치로 앞당김 + 수동 갱신을 구현한다. 변경사항이 없으면 AI를 호출하지 않는다. 원본은 즉시 저장하며, 갱신 작업은 증분 분석, 중복 방지, 재시도 가능한 상태로 설계한다.
12. 충돌 시 사용자 검토 전 기존 정보의 충돌 부분을 덮어쓰지 않는다. 공통 검토 기록 1건을 알림/관리에서 재사용한다.
13. 구조화된 AI 출력은 스키마 검증과 출처 매핑을 통과해야 DB에 반영한다. 근거 없는 정보·퍼센트·참조 출처를 만들어내지 않는다.
14. UI는 ChatGPT 데스크톱 앱의 **간결한 사용감**만 참고하고 실제 로고·전용 이미지 자산은 복제하지 않는다. 햄버거 메뉴, 중앙 메인 채팅, 문서 열람 시 좌측 채팅 이동, 우측 3탭 보조 패널을 지킨다.
15. 테스트를 변경 사항에 따라 추가한다. 최소 `lint`, `typecheck`, 단위 테스트, 해당 E2E, 빌드 검증. 외부 키가 없으면 mock으로 재현 가능한 테스트를 구현하고 실제 연동 미검증임을 기록한다.
16. 거짓 완료 보고 금지. 미구현·실제 API 키·배포·비용 검증이 필요한 부분은 명시적으로 TODO/blocked로 관리한다.

## 코드 구조와 협업 방식

- `src/app/`은 라우트, `src/modules/`는 도메인 기능, `src/shared/`는 공통 UI와 계약, `src/server/`는 DB·외부 시스템 어댑터를 소유한다. `supabase/`에는 마이그레이션, `prompts/`에는 런타임 프롬프트를 둔다.
- 컴포넌트에서 직접 서비스 역할 키나 OpenAI API를 호출하지 않는다.
- 복잡한 업데이트는 idempotency key + DB 트랜잭션/잠금으로 원자성을 지킨다.
- 에러 메시지는 사용자에게 이해 가능하게 표시하고 원본 저장 실패를 조용히 무시하지 않는다.
- 주기적 작업이 비용 상한에 도달하면 중지하고 화면에 상태를 표시한다.
- 의존성은 공식 문서를 확인하고 버전을 고정(lockfile). 알 수 없는 API나 인자를 지어내지 않는다.

## 완료 보고 형식

- 구현한 사용자 동선
- 생성/수정 파일 및 스키마 변경
- 실행한 검증과 결과(실패 포함)
- 필요한 외부 설정·인증·키
- 다음 단계 한 가지 또는 명확한 차단 요인

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 모듈 경계와 변경 검증

새로운 기능을 구현할 때 기존 모듈의 책임을 먼저 확인하고, 해당 모듈에 기능을 추가하거나 공개 인터페이스를 통해 연결한다. 모듈 경계를 무너뜨리는 임시 구현과 순환 의존성을 만들지 않는다.

- 현재 구현의 소유자와 공개 인터페이스는 `docs/architecture.md`에 기록한다. 다른 모듈에서는 해당 모듈의 루트 또는 서버 전용 `server.ts`를 사용한다. 타입과 재수출에도 같은 규칙을 적용한다.
- 모듈 결합은 화면 조립 또는 유스케이스 서비스에서 처리한다. 각 모듈이 자기 도메인의 RPC 호출을 담당한다. 여러 테이블에 걸친 하나의 저장 작업은 기존 트랜잭션 경계를 보존한다.
- 요청 라우트는 인증, 유효성 확인, 디스패치와 HTTP 응답을 담당한다. 공통 표현·전송 계약은 shared, 외부 프로토콜과 DB 어댑터는 server에 둔다.
- 변경 전후 lint(경계·순환 검사 포함), typecheck, 관련 Vitest와 Playwright, build를 실행한다. 기존 데이터·요청과 호환되는 추가 마이그레이션을 사용한다. 공개 계약을 바꾸면 이 문서와 회귀 테스트를 함께 갱신한다.
