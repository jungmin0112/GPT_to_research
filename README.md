# GPT to search

개인용 AI 자료조사·다층 탐구·지식 통합 웹 애플리케이션. M0 프로젝트 작업 공간과 M1 메인 채팅의 첫 구현을 포함한다.

## 현재 구조와 Windows 업데이트

앱의 진입점은 `src/app`, 업무별 공개 인터페이스는 `src/modules`, 공통 UI·계약은 `src/shared`, DB와 ChatGPT 어댑터는 `src/server`에 있다. [모듈별 소유권·호출 관계 및 검증](docs/architecture.md)

1. 실행 중인 앱을 종료하고 업데이트 ZIP을 별도 폴더에 푼다. 기존 앱 루트의 `.env.local`을 새 프로젝트 루트에 복사한다. 로컬 mock 기록을 사용할 때만 기존 `.mock-data` 폴더도 복사한다.
2. 자료 보관 업데이트까지 적용한 Supabase에서는 SQL Editor로 `supabase/migrations/202611190003_source_turn.sql`을 한 번 실행한다. 이전 버전이라면 migrations의 미적용 파일만 이름 오름차순으로 먼저 실행한다. 기존 소유자 등록은 유지한다.
3. 새 프로젝트 루트에서 `npm ci`, `npm run dev:plus` 후 기존과 같은 http://127.0.0.1:3000 을 연다. 같은 Windows 계정·Supabase 설정을 사용하면 기존 DPAPI 계정 저장 위치를 재사용한다. 승인이 만료되었다면 모델 및 계정에서 다시 연결한다.
4. 기존 프로젝트의 자료 두 개를 열고 2분할한다. 사용할 탭에서 **현재 자료로 질문하기**를 누른 뒤 내용을 편집하고 전송한다. 답변·원문을 새로고침해 확인한다.

## 제품 목표

ChatGPT처럼 질문하고 웹 자료를 탐색하면서 원문 전용 미니 세션과 자유로운 다층 심화 탐구를 사용할 수 있다. 원본 기록을 중앙에 보존하고, 프로젝트별로 확인된 조사 결과를 지식 그래프에 자동 통합한다. 사용자는 관련 세션을 찾고 이전 탐구를 재개할 수 있다.

## 확정 기술 방향

- **웹**: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui
- **시각화**: `@xyflow/react`(세션 그래프 + 결과물 그래프)
- **서버**: Next.js Route Handlers, Supabase Edge Functions(TypeScript/Deno)
- **데이터**: Supabase PostgreSQL, Auth, 비공개 Storage; 검색은 우선 SQL/FTS, 필요할 때 pgvector
- **AI**: OpenAI Responses API와 지원 모델의 웹 검색 도구
- **작업**: Supabase Cron이 갱신 시점을 확인하고 작업자 함수를 호출
- **배포**: Vercel(웹) + Supabase(DB/작업)
- **검증**: Vitest, Playwright, TypeScript, ESLint

모델명·요금·각 API의 인자 등은 코딩 시점의 공식 문서를 확인하여 구현한다. 이용 가능한 모델을 임의로 단정하지 않는다.

## 문서 읽는 순서

1. [`CODEX_START.md`](CODEX_START.md) — 첫 Codex 요청 및 착수 절차
2. [`AGENTS.md`](AGENTS.md) — 코딩 에이전트 필수 준수 규칙
3. [`docs/01_requirements.md`](docs/01_requirements.md) — 기능과 사용자 경험의 기준
4. [`docs/02_architecture.md`](docs/02_architecture.md) — 시스템 및 AI 맥락 구조
5. [`docs/03_data_model.md`](docs/03_data_model.md) — 데이터 구조·관계·불변식
6. [`docs/04_api_contracts.md`](docs/04_api_contracts.md) — 서버 API 계약
7. [`docs/05_ui_ux.md`](docs/05_ui_ux.md) — 화면·동선·레이아웃
8. [`docs/06_implementation.md`](docs/06_implementation.md) — 개발 단위 및 인수 기준
9. [`docs/07_testing.md`](docs/07_testing.md) — 검증 및 회귀 테스트
10. [`docs/08_decisions.md`](docs/08_decisions.md) — 확정 사항과 구현 기본값의 구분
11. [`docs/09_sources.md`](docs/09_sources.md) — 기술 공식 문서

`prompts/`는 **완성된 앱의 런타임 AI**에 주는 역할별 지침이다. `AGENTS.md`는 **개발하는 Codex**의 지침이다. 둘을 혼동하지 않는다.

## 로컬 실행

Node.js 24와 npm을 사용한다. 프로젝트 루트에서 다음 명령을 실행한 뒤 http://127.0.0.1:3000 을 연다.

```bash
npm ci
npm run dev:mock
```

테스트 계정 로그인 → 새 프로젝트 → 이름·목적 입력 → 생성하고 열기 순서로 진행한다. 주소의 세션 ID와 로그인 쿠키로 새로고침 후 같은 공간을 연다. 프로젝트 메뉴에서 홈 및 다른 프로젝트로 이동할 수 있다. mock은 개발 모드의 루프백에서만 사용한다. PostgreSQL 엔진인 PGlite가 실제 앱 SQL과 RLS를 실행하며 로컬 자료는 `.mock-data/`에 유지된다. 인증과 모델 응답은 테스트용이고 외부 API 비용은 발생하지 않는다.

## Supabase와 OpenAI 연결

1. Supabase에서 공개 가입을 끄고 이메일과 비밀번호로 로그인할 개인 계정 하나를 생성한다. 해당 Auth UUID를 확인한다.
2. Supabase CLI로 대상 프로젝트를 연결한 뒤 `npx supabase db push`를 실행하거나, SQL Editor에서 `supabase/migrations/*.sql`을 파일 이름 순서로 적용한다. 프로젝트·메인 세션은 하나의 DB 트랜잭션에서 생성된다. PDF 원본은 비공개 Storage 버킷에 저장한다.
3. SQL Editor에서 아래 UUID를 실제 소유자 UUID로 바꿔 허용 계정을 등록한다.

```sql
insert into public.app_owner(owner_id) values ('YOUR_SUPABASE_AUTH_USER_UUID');
```

4. `.env.local`에 기존 Supabase URL, publishable/anon 키, OWNER_USER_ID를 유지한다. 기존 사용자는 미적용 마이그레이션만 순서대로 실행한다.
5. Windows에서 `npm ci`, `npm run dev:plus`를 실행하고 http://127.0.0.1:3000 에서 메인 세션을 연다. **Continue with ChatGPT**를 눌러 공식 승인 화면에서 계정·워크스페이스·플랜 사용 권한을 선택한다. 앱이 승인 계정의 모델 목록을 조회하며 첫 표시 모델을 기본으로 사용한다. 기존 OPENAI_API_KEY 값은 이 경로에서 사용하지 않는다.

[Windows 적용·승인·실계정 검증 절차](docs/10_chatgpt_plan.md)

## 프로젝트 자료 수집

메인 세션의 프로젝트 자료함에서 URL·PDF·텍스트와 검색 출처를 보관하고 열 수 있다. [추가 SQL과 Windows 적용 순서](docs/11_project_materials.md)

## 검증

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

시스템 Chromium을 사용할 때는 `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`로 실행한다. Supabase가 연결된 로컬 테스트 앱에는 `LOCAL_APP_URL`, `TEST_OWNER_EMAIL`, `TEST_OWNER_PASSWORD`를 환경으로 지정하고 `node tests/live/local-auth.mjs`를 실행한다. 이 검사는 테스트 프로젝트 한 개를 만든다. ChatGPT 플랜 연결 전 `TEST_NO_MODEL=1`을 추가하면 실패·재시도 후 원본 질문 복원도 검사한다.

DB 타입은 마이그레이션이 적용된 PostgreSQL의 public 스키마에서 postgres-meta로 생성했다. 로컬 Supabase에서 스키마 변경 후 `npx supabase gen types typescript --local --schema public > src/server/database/database.types.ts`로 갱신한다.

## 현재 검증 범위

- 로컬 GoTrue·PostgREST·PostgreSQL 17과 실제 Chromium에서 이메일 로그인, 생성, 새로고침, 로그아웃, 재로그인 및 같은 세션 복원을 확인했다. 테스트용 로컬 라우터가 Auth와 REST 요청을 각 서비스로 전달했다. 별도 계정은 앱에서 403을 받았고, 같은 계정의 JWT로 PostgREST에 직접 요청했을 때 프로젝트 목록은 비어 있었다.
- 테스트 계정·모델로 대화 스트림과 출처 복원을 검사했다. 실제 OpenAI SDK의 요청 형식과 응답 이벤트 파싱은 HTTP fixture로 검사했다.
- 운영 Supabase, Storage 서비스, OpenAI 실호출·검색 품질·비용, Vercel 배포는 미검증이다. 월간 예산 제어, 모델·추론 오버라이드, M2~M5는 후속 범위다. 현재 세션 기록을 매 요청에 재구성하므로 긴 대화의 압축과 입력 토큰 예산도 후속 작업이다.

## 배포 전 확인

- 개인 계정 인증, RLS, 비공개 자료 저장, 서버 측 OpenAI 키 보호
- API 호출 비용 및 자동 갱신 횟수에 대한 사용자 설정·상한
- 외부 자료 저장 권한·웹사이트 접근 제한, 허용되지 않는 전문 복제 방지
- 원본 및 수정 이력 보존, 출처 추적
- 모바일은 기본 기능을 화면 전환 방식으로 제공; 데스크톱·태블릿 우선

> 디자인 참고: ChatGPT 데스크톱 앱의 간결한 사용감. OpenAI의 로고·브랜드 자산을 복제하지 않는다. `GPT to search`는 현재 개인용 작업명이며 공개 제품명 사용 전 상표·브랜드 가이드 검토가 필요하다.
