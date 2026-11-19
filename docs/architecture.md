# 현재 구현 아키텍처

한 Next.js 프로세스가 UI와 Route Handlers를 제공한다. 실사용 데이터는 기존 Supabase 프로젝트 한 곳에 저장한다. 개발용 PGlite는 같은 업무 SQL을 실행한다.

## 전환 전 조사

프로젝트 생성·로그인·탐색·패널은 app/page.tsx에, 채팅 표시와 SSE 해석은 components/chat.tsx에 있었다. components/material-workspace.tsx는 자료 목록·열람과 채팅을 함께 조립했다. features/research.ts는 컨텍스트 구성·외부 요청·스트림 해석을 함께 담당했다. lib에는 DB, 인증, 브라우저 요청, 자료 및 채팅 타입이 혼재했다. 프로젝트 조회가 라우트와 채팅에 걸쳐 있어 변경 시 양쪽을 확인해야 했다. 테스트는 SQL·서버 서비스·HTTP fixture·브라우저 동선에 걸쳐 있었다. 인계본에는 Git 메타데이터와 참고 프로토타입이 없었다. 인계 시점 파일을 복사해 기준으로 삼았고 전환 전 타입 검사·lint·빌드, Vitest 9건·Playwright 4건을 실행했다.

## 모듈과 공개 계약

| 모듈 | UI 진입점 | 서버 인터페이스 및 데이터 책임 |
|---|---|---|
| Projects | ProjectHome, Project | projectsRoute, listProjects. 프로젝트 조회 및 기존 프로젝트·메인 세션 생성 트랜잭션 |
| Sessions | Chat | chat. 질문·응답 시도 및 재시도, SSE, 대화 기록 저장 |
| AI & Context | PlanSettings | planRoute, research, describeFailure. 명시 참조와 기록으로 입력 구성, 모델 및 검색 요청 |
| Sources & Reader | MaterialLibrary, Reader, readMaterial, Material | materials, sourceReference. URL·PDF·텍스트, 검색 자료 및 원문 조회와 재수집 |
| Graphs | SessionGraph | Projects 공개 타입에서 받은 현재 메인 세션의 미리보기와 열기 이벤트 |
| Workspace | 기본 화면 | 프로젝트·세션 선택, 탭, 분할·패널·스크롤 상태와 기능별 UI 조립 |

UI는 src/modules/모듈명/index.ts(x), 서버는 해당 모듈의 server.ts를 사용한다. shared는 버튼·안전한 링크·브라우저 요청·대화 계약을 제공한다. server/database는 소유자 인증 컨텍스트와 RPC·타입 및 mock DB 어댑터, server/integrations/chatgpt는 OAuth·Windows 자격 증명 저장·Responses 스트림을 담당한다.

## 요청과 저장 흐름

- Workspace → Projects, Sessions, Sources, AI, Graphs. Graphs → Projects 공개 타입. 앱 라우트 → 모듈의 서버 진입점.
- Sessions의 대화 서비스 → Projects에서 대상 조회 → Sources에서 명시 참조 검증 → AI에서 컨텍스트 구성 → ChatGPT 어댑터 호출 → Sessions에서 스트림 완료·실패 저장. 자료 ID는 같은 프로젝트에 있고 본문 확보가 끝난 경우에만 허용한다. 선택한 원문의 앞 24,000자까지 현재 질문에 포함한다. 다음 질문에는 ID를 다시 지정해야 한다.
- 원문 URL·PDF·텍스트 등록 → Sources → 기존 RPC 및 비공개 PDF 저장소. 답변 완료 시 기존 SQL 트리거가 검색 후보·인용을 답변 기록과 같은 트랜잭션에서 자료함에 반영한다.
- 새 begin_source_turn RPC는 기존 begin_turn과 같은 트랜잭션에서 응답 시도에 참조 ID를 기록한다. ID가 없는 기존 요청은 기존 RPC를 그대로 쓴다. 참조는 자료 ID를 가리키며 본문 버전을 고정하지 않는다.
- Workspace는 세션별 열린 자료 ID·선택·분할·위치를 브라우저 sessionStorage에 기록한다. 복원 시 서버에서 자료를 재조회한다. 질문 초안과 참조도 세션별로 유지한다. 같은 브라우저 탭의 세션 이동·새로고침이 복원 범위다.

## 다음 모듈과 제약

심화·미니 세션은 각각 Sessions와 Sources의 공개 기능으로 연결한다. Knowledge가 결과물·기여도·수정 이력을 소유하면 Graphs는 공개 조회를 소비한다. Updates가 변경 조회·AI 분석·Knowledge 갱신을 조립하고, Conflicts가 검토 결정을 소유한다. 현재 데이터 모델에는 심화 분기·결과물 노드·검토 기록이 없어 해당 그래프 필터·그룹, 결과물/관리 화면을 구현하지 않았다.

SQL 함수와 트리거 사이의 결합은 TypeScript import 검사 범위 밖에 있다. DB 타입을 갱신하고 SQL 저장·조회 회귀 테스트를 함께 실행한다. 긴 대화 컨텍스트의 토큰 예산과 원문 버전 고정은 후속 과제다.

## 개발 검증

npm run check:modules는 TypeScript 경로 해석을 사용해 상대·별칭 import, 재수출, 동적 import와 타입 참조를 검사한다. 다른 모듈 내부 진입, 하위 계층의 상위 계층 참조 및 파일·모듈 순환을 오류로 처리한다. npm run lint에도 포함된다. tests의 Vitest는 어댑터·RPC·모델 이벤트를, tests/e2e의 Playwright는 실제 Next.js 서버와 Chromium에서 사용자 동선을 확인한다. 운영 인증과 모델 통신은 Windows 사용자 계정에서 별도로 확인한다.
