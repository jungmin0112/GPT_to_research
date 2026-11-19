`npm test`는 임베디드 PostgreSQL로 마이그레이션·RLS·채팅 재시도를 검사하고, 루프백 HTTP fixture에 실제 OpenAI SDK 요청을 보낸다. `npm run test:e2e`는 임시 데이터 디렉터리와 로컬 mock 계정으로 Chromium을 실행한다. 실제 Supabase 컴포넌트가 연결된 루프백 앱의 재접속 검사는 `tests/live/local-auth.mjs`를 사용한다. 환경 설정은 루트 README를 참조한다.

workspace 리팩터링에서는 기존 형식의 프로젝트·답변·자료를 넣고 추가 SQL 적용 전후 조회 결과를 비교한다. research.test.ts는 명시 참조를 선택한 요청의 컨텍스트, 다음 요청의 제외, 잘못된 ID 거부를 확인한다. boundaries.test.ts는 정상 공개 경로와 금지된 재수출·순환을 검사한다. e2e/layout.spec.ts는 세션 전환, 분할과 스크롤, 패널, 편집 후 Enter 전송과 자료 ID 저장을 검증한다.
