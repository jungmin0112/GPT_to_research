# Workers Free 테스트

[gpt-to-research-test.workers.dev 테스트](https://gpt-to-research-test.jungmin0112nice.workers.dev) · [소유자 전용 Sites 테스트](https://gpt-to-research-worker-test.jungmin0112nice.chatgpt.site)

이 브랜치는 로그인, 소유자별 프로젝트 조회, 예약 실행의 Workers 호환성을 검증한다. 테스트 화면은 GET /, 모드 확인은 GET /api/mode, 로그인과 로그아웃은 POST /api/login 및 /api/logout, 조회는 GET /api/projects다. 기존 Next.js 앱과 VM 서비스는 기존 경로에서 실행한다.

## 설정과 권한

- Worker 이름은 gpt-to-research-test, 호환 날짜는 2026-11-19다. Cloudflare Workers API의 ES module 업로드로 worker.mjs를 배포하고 workers.dev를 활성화한다. 재배포 시 기존 secret_text 바인딩을 유지한다.
- Worker Settings → Variables and Secrets에서 SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, OWNER_USER_ID를 등록한다. 런타임은 사용자의 JWT로 기존 project_list RPC를 호출하고 Supabase RLS를 적용한다. 로그인·토큰 갱신 시 소유자를 확인한다. 쿠키는 HttpOnly, Secure, SameSite=Strict이며 서버 응답은 캐시하지 않는다.
- 전용 Sites 테스트 게이트웨이는 기존 hosting/sites/worker.mjs의 헤더·쿠키 필터를 재사용한다. build-sites-test.mjs가 workers.dev 테스트 주소와 해당 게이트웨이를 조립한다. 기존 개인용 Sites 연결은 유지한다.

## 예약 갱신

10분마다 실행하는 식은 `*/10 * * * *`이며 하루 144회다. 설정이 비어 있으면 예정 실행은 unconfigured를 기록하고 외부 호출을 생략한다. Worker 로그에서 research-update, scheduledTime, result로 호출과 처리 결과를 구분한다.

기존 분석까지 수행하려면 서버 전용 HTTPS 원점 UPDATE_SERVER_ORIGIN, 테스트할 프로젝트 UUID UPDATE_PROJECT_ID, 비공개 WORKER_OWNER_EMAIL과 WORKER_OWNER_PASSWORD가 필요하다. 로그인 → 한 프로젝트의 updates(manual=false) → 로그아웃 순으로 호출한다. 실제 분석과 중복 방지·플랜 한도 처리는 VM과 DB가 담당한다. 이 테스트는 프로젝트 하나를 대상으로 하며 기존 전체 프로젝트 작업자의 대체 여부는 운영 전 별도 결정한다. 작업자가 없는 환경에서 데이터를 선점하거나 플랜 대신 API 키를 사용하지 않는다.

Workers Free의 CPU 시간은 HTTP 또는 예약 호출당 10ms, 외부 하위 요청은 호출당 50회다. 이 어댑터가 정상 예약 한 번에 보내는 하위 요청은 3회다. 무료 한도는 계정 전체 사용량 및 실제 실행 CPU 시간에 영향을 받는다. [공식 한도](https://developers.cloudflare.com/workers/platform/limits/)

## 검증 범위

`node --test hosting/cloudflare/worker.test.mjs hosting/sites/worker.test.mjs`로 모의 인증 서버를 통한 세션 갱신, 소유자 거부, Sites 쿠키 전달, 증분 갱신 인자를 검사한다. 실제 계정 인수는 각 HTTPS 주소에서 로그인 후 보이는 목록과 재조회, 로그아웃 후 401로 확인한다.

Next.js 프로덕션 빌드는 통과한다. 원래 앱은 PDF 추출을 위해 child_process.execFile을 호출하고, 플랜 OAuth에 로컬 포트 리스너와 영구 파일 금고를 쓴다. 로컬 workerd의 nodejs_compat 모드에서 child_process 실행이 미구현으로 반환되는 것을 확인했다. 전체 서버 호환 판정과 테스트 어댑터의 배포 결과는 별개다.
