# 통합 MVP 적용과 개인용 HTTPS 운영

## Windows 업데이트

기존 앱을 종료하고 ZIP을 새 폴더에 푼다. 기존 앱의 `.env.local`을 새 앱 루트에 복사한다. 같은 Supabase 프로젝트와 OWNER_USER_ID를 사용하면 Windows 사용자에 묶인 기존 플랜 등록과 프로젝트 데이터를 계속 사용한다. Node 24 LTS에서 아래 명령을 실행한다. 기존 폴더는 적용 확인까지 보관한다.

```powershell
npm ci
npm run build
npm run start:plus
```

로컬 주소는 http://127.0.0.1:3000 이다. 로컬 앱과 호스팅 앱의 브라우저 저장소는 서로 독립적이다. 프로젝트, 대화, 원문, 독해 아카이브와 결과물은 중앙 DB에 저장하고 표시 탭·스크롤·초안은 해당 브라우저의 세션에서 복원한다.

## Supabase SQL 순서

Dashboard의 마이그레이션 기록과 실제 DB 객체를 대조해 **미적용 파일만** 번호 순으로 실행한다. 기존 SQL을 수동으로 적용했다면 파일별 생성 객체를 확인한다. 이미 적용한 SQL을 일괄 재실행하면 중복 객체 오류가 발생할 수 있다. 적용 전에 프로젝트의 복구 가능한 백업을 확인한다.

| 순서 | supabase/migrations 파일 | 역할 |
|---|---|---|
| 1–3 | 202611180001_workspace.sql → 202611180002_storage.sql → 202611180003_chat.sql | 기존 프로젝트·소유자·채팅과 버킷 |
| 4–7 | 202611190001_sources.sql → 202611190002_material_storage.sql → 202611190003_source_turn.sql → 202611190004_material_library.sql | 기존 자료함·PDF 권한·메시지 첨부·검색 |
| 8 | 202611190005_exploration.sql | 다층 분기, 미니 세션과 전달 기록 |
| 9 | 202611190006_knowledge.sql | 원본 이벤트, 기존 기록 등록, 통합 노드·검토 |
| 10 | 202611190007_discovery.sql | 통합 검색, 근거 분리·이력, 결과물 참조·분기 |
| 11 | 202611190008_reading_policy.sql | 출처별 참조 범위와 독해 정리 캐시 |
| 12 | 202611190009_update_schedule.sql | 자동 분석 시도 기록, 활동 우선순위·간격·일일 한도 |

SQL Editor에서 `supabase/check-material-library.sql`과 `supabase/check-integrated-mvp.sql`을 차례로 실행한다. 정상 결과는 각각 11행, 22행 모두 ready다. 프로젝트 데이터와 토큰을 출력하지 않는다. 그 후 소유자로 로그인해 자료함을 열고 수집을 실행한다. 실패 시 앱에 나온 RPC 이름과 코드만 확인한다. 별도 PostgreSQL 17/PostgREST 16.5에서 자료 SQL을 생략하면 list_materials와 claim_material 모두 PGRST202, 적용 후 둘 다 HTTP 200이었다. 사용자 프로젝트에서 관측된 앱 503의 내부 코드와 실제 SQL 적용 상태는 미확인이다.

## 개인용 상시 호스트

PC를 꺼도 동작하려면 디스크가 유지되는 **소유자 전용 상시 VM**에서 Node 앱과 갱신 작업자를 실행한다. 아래는 Linux VM 예시다. 호스팅 계정, 도메인, TLS 인증서와 실제 Plus 승인은 운영자가 준비한다. 정적 Sites 페이지나 일시적 서버리스 함수만으로는 이 앱의 로컬 OAuth 콜백·플랜 금고·상시 작업자를 운영할 수 없다.

1. Supabase에서 회원 가입을 닫고 Auth의 Site URL을 전용 HTTPS 주소로 설정한다. app_owner와 서버 OWNER_USER_ID를 같은 사용자로 설정한다. 공개 가능한 Supabase 키와 서버 소유자 UUID만 앱에 설정한다.
2. DNS를 VM으로 연결한다. 예시는 아래와 같다. 프록시가 원래 Host를 유지하고 허용된 도메인만 전달해야 한다. Node 포트와 OAuth 임시 포트는 호스트 내부에서만 접근한다. TLS 프록시에서 SSE 버퍼링을 끈다.
3. 앱 루트에 `.env.local`을 설정한다. 빌드 전에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하고 OWNER_USER_ID와 `PRIVATE_APP_HTTPS_ORIGIN=https://research.example.org`를 지정한다. 전용 OS 계정으로 `npm ci && npm run build` 후 `npm run start:plus`를 재시작 가능한 서비스로 실행한다. PHP나 Edge 런타임 대신 Node와 자식 프로세스를 지원하는 런타임이 필요하다.
4. 같은 OS 계정의 영구 홈에서 플랜을 승인한다. VM의 비공개 원격 데스크톱으로 VM 내 브라우저와 앱을 함께 열 수 있으면 http://127.0.0.1:3000 의 설정에서 직접 승인한다. 태블릿의 HTTPS 설정에서는 연결 상태·해제에 접근할 수 있다. 또는 아래의 SSH 이전 절차를 사용한다.
5. 별도 서비스의 비공개 환경에 WORKER_OWNER_EMAIL과 WORKER_OWNER_PASSWORD를 설정하고 앱과 같은 호스트에서 `npm run worker`를 실행한다. 운영자는 프로세스 관리자로 앱과 작업자가 재부팅 후 재시작하도록 설정한다. 작업자는 루프백으로 소유자 로그인 후 1분마다 모든 프로젝트를 확인한다. 프로젝트마다 자동 분석 간격 3–10분, 24시간 자동 **시도** 50회 한도이며 수동 갱신은 별도다. 처리할 기록이 없으면 모델을 호출하지 않는다. 한도는 ChatGPT가 부여한 플랜 사용량과 별개다.

```caddyfile
research.example.org {
    reverse_proxy 127.0.0.1:3000 {
        flush_interval -1
    }
}
```

### 기존 Windows 플랜을 SSH로 옮길 경우

VM과 PC 모두 Node 24, 같은 앱 버전·Supabase URL·소유자 UUID를 사용한다. VM에서 앱을 실행할 OS 계정으로 먼저 아래를 실행한다.

```sh
node --env-file=.env.local --conditions=react-server scripts/plan-vm.mjs prepare
```

그 계정의 SSH PATH에 실행 가능한 `gts-import-plan`을 설치한다. 아래 래퍼의 절대 경로는 실제 설치 위치로 맞춘다. VM에 이미 같은 등록이 연결되어 있으면 가져오기가 거부된다. Linux에서는 암호화된 호스트 디스크와 계정 전용 디렉터리·파일 권한(0700/0600)을 사용한다.

```sh
#!/bin/sh
cd /srv/gpt-to-search || exit 1
exec /usr/bin/node --env-file=.env.local --conditions=react-server scripts/plan-vm.mjs receive
```

PC에서 VM SSH 호스트 키를 별도 경로로 확인해 known_hosts에 등록하고 비대화형 키 인증을 확인한다. 앱을 종료한 뒤 활성 플랜을 이동한다.

```powershell
node --env-file=.env.local --conditions=react-server scripts/plan-vm.mjs move owner@research.example.org
```

이 명령은 선택한 등록을 SSH 표준입력으로 전송하고 VM 저장 성공 후 PC에서 해당 등록의 토큰을 제거한다. VM 고유 호스트 ID를 보존하며 이후 갱신은 VM이 담당한다. 이전한 세션의 호스트별 사용량 귀속·철회에는 공식 프리뷰 제약이 있다. 필요할 때 VM에서 재승인한다. 등록·토큰·DPAPI 파일을 사이트 업로드나 브라우저 저장소에 넣지 않는다. 모든 AI 경로가 플랜 OAuth를 사용하며 제한 또는 모델 오류는 해당 작업에 표시한다. 모델별 추론 수준 지원 여부는 실제 모델로 확인한다.

[공식 VM 절차](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms) · [Responses 제약](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

## 운영 인수 확인

- PC와 태블릿에서 같은 HTTPS 주소에 소유자로 로그인한다. 한 기기에서 생성한 프로젝트·미니 문답·충돌 검토를 다른 기기에서 새로고침해 확인한다.
- 직접 등록한 자료와 웹 검색 자료를 확인하고 실제 플랜으로 미니 문답, 다 읽음, 수동 분석, 모델별 추론 설정, 인용 링크를 시험한다. 실제 결과는 모델과 계정 사용량에 따라 달라진다.
- PC 전원을 끈 상태에서 서버 작업자 로그와 최근 갱신 활동을 확인한다. VM 재시작 후 원문·채팅·플랜 연결과 토큰 갱신을 확인한다.
- 프로젝트별 결과물에서 Markdown과 PDF를 내려받는다. PDF는 한글 기기 폰트를 사용한 이미지 페이지이므로 PDF 본문 텍스트 선택과 검색은 지원하지 않는다. 텍스트 재사용에는 Markdown을 사용한다.

## ChatGPT Sites 웹 주소

Sites에는 이 앱의 실제 프로덕션 브라우저 화면과 HTTP Worker를 배포한다. 연결 전에는 서버 대기 상태가 표시된다. VM 준비 후 Sites 서버 환경 변수 RESEARCH_SERVER_ORIGIN을 VM의 HTTPS 원점으로 설정하고 VM의 PRIVATE_APP_HTTPS_ORIGIN에도 같은 VM 원점을 지정한다. Worker는 인증 쿠키를 Site 호스트에 저장하고 허용한 Supabase 세션 쿠키와 앱 요청만 VM에 전달한다. 개인용 Sites 접근 권한과 Supabase 소유자 인증이 모두 적용된다. OAuth 승인은 VM에서 진행한다.
