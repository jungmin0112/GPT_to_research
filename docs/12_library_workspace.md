# 자료함 업데이트 적용

1. 기존 Windows 앱을 종료하고 새 ZIP을 별도 폴더에 푼다. 같은 Windows 계정에서 기존 앱의 .env.local을 새 package.json 옆에 복사한다. 기존 로컬 mock을 사용하면 .mock-data도 함께 복사한다.
2. 기존 Supabase 프로젝트 SQL Editor에서 supabase/check-material-library.sql을 실행한다. 프로젝트 내용이나 키를 출력하지 않는 조회다. 이전 M0 및 기본 채팅 SQL이 이미 적용된 경우 아래 순서를 사용한다.
3. 각 파일의 검사 항목이 모두 missing이면 해당 마이그레이션을 실행한다. 모두 ready인 이전 단계는 건너뛴다. 한 파일 안에 missing과 ready가 섞여 있거나 missing grant가 나오면 해당 객체·권한을 원본 SQL과 대조해 누락 부분을 복구한다. 이전 마이그레이션에는 이미 존재하는 테이블이나 정책을 재생성하는 구문이 있다.

| 순서 | supabase/migrations 파일 | 대상 |
|---|---|---|
| 1 | 202611190001_sources.sql | 자료 테이블·조회·작업 선점·답변 출처 보관 |
| 2 | 202611190002_material_storage.sql | 비공개 PDF 정책 |
| 3 | 202611190003_source_turn.sql | 질문에 연결한 자료 ID |
| 4 | 202611190004_material_library.sql | 제목·출처 및 유형 검색 |

4. 확인 SQL을 다시 실행한다. RPC가 ready인데 PGRST202가 계속되면 앱이 연결한 프로젝트와 SQL Editor의 프로젝트가 같은지 확인하고 SQL Editor에서 `notify pgrst, 'reload schema';`를 실행한다.
5. 새 폴더에서 `npm ci`, `npm run dev:plus` 후 기존 주소를 연다. 프로젝트 메뉴 → 자료함에서 검색하고 메시지 입력창의 ＋에서 새 자료 등록 또는 기존 자료 첨부를 선택한다. 첨부는 질문당 자료 하나이며 실제 전송 전에 바꾸거나 해제할 수 있다. 본문 확보 실패 자료는 자료함에서 원문 링크와 오류 사유를 열 수 있다.
6. 설정에서 ChatGPT 계정 연결을 관리한다. 연결된 모델 선택은 대화 입력창 옆에 있다. 기존 사용자·프로젝트·답변·원문은 같은 Supabase에서 읽는다.

## 503 판별

이전 서버는 PostgREST 오류를 모두 HTTP 503 하나로 변환했다. 새 서버는 RPC 이름과 제한된 형식의 원본 오류 코드를 반환한다. 실제 PostgreSQL 17/PostgREST 16.5에서 자료 마이그레이션이 없는 데이터베이스의 list_materials와 claim_material을 호출하면 두 RPC 모두 PGRST202가 발생했다. 전체 마이그레이션 후 동일한 요청이 200으로 복구됐다. 42501은 실행 권한 검토 대상이며, 00000은 성공 코드다. 운영 계정의 실패 원인은 그 요청에서 기록된 코드로 판별한다. PDF Storage 정책은 DB 목록·작업 선점 RPC와 별도로 검사한다.

## 같은 HTTPS 주소로 배포하려면

이번 결과물은 로컬 Next.js 앱이다. Sites 호스팅의 서버 런타임은 Cloudflare Worker다. 현재 앱의 Windows DPAPI 토큰 보관, 루프백 OAuth 콜백, Node 기반 PDF 자식 프로세스와 URL 수집 전송 계층에는 런타임 차이가 있다. 현재 로컬 ChatGPT 플랜 승인을 원격 서버에 복사하거나 호스트 검사를 해제하는 것만으로는 배포할 수 없다. 호스팅 단계에서 공식 지원되는 인증·토큰 보관 방식 및 문서 처리 경계를 결정하고, 동일한 HTTPS 오리진에서 PC·태블릿 로그인을 검증해야 한다. 유료 API 키 자동 전환은 구현하지 않는다.
