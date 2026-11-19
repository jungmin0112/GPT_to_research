# Windows에서 ChatGPT 플랜 연결

## 기존 앱에 적용

1. 실행 중인 개발 서버를 Ctrl+C로 종료한다. 업데이트 ZIP의 내용물을 기존 앱 폴더(package.json이 있는 위치)에 덮어쓴다. ZIP에는 변경 파일만 있다. 로컬에서 직접 수정한 소스는 먼저 백업한다.
2. 기존 앱 폴더의 PowerShell에서 아래 명령을 실행한다. Node.js 24를 기준으로 한다.

```powershell
npm ci
npm run dev:plus
```

3. http://127.0.0.1:3000 을 연다. 이전에 localhost를 사용했다면 브라우저의 쿠키 범위가 달라 Supabase 로그인이 한 번 더 필요할 수 있다. 같은 계정의 기존 프로젝트와 메인 세션을 연다. 추가 SQL이나 .env.local 수정은 필요 없다.
4. **Continue with ChatGPT**를 누른다. 공식 auth.openai.com에서 본인이 로그인하고 사용할 워크스페이스와 GPT to search의 플랜 사용을 승인한다. 승인 콜백은 이 PC의 127.0.0.1 임시 포트에서 5분간 기다린다. 만료되면 앱에서 다시 시작한다. 앱으로 복귀한 뒤 계정과 모델을 확인한다.
5. 검색을 **사용 안 함**으로 두고 “연결 확인이라고만 답해 줘”를 전송한다. 답변 완료 후 F5를 눌러 같은 질문과 답변이 복원되는지 확인한다. 개발 서버를 재시작해도 계정 연결과 대화가 각각 복원되는지 확인할 수 있다.
6. 별도 질문에서 **검색 요청**을 선택하고 “오늘 OpenAI 공식 개발자 문서를 검색해서 한 문장으로 요약하고 출처를 알려 줘”를 보낸다. 실제 도구 사용 표식과 인용 링크를 확인하고 F5로 복원한다. 모델·계정 정책에 따라 검색은 거부될 수 있다. 검색 후보와 인용은 공급자가 반환한 경우만 표시한다.

## 계정 및 사용량

ChatGPT 연결은 Supabase 소유자로 로그인한 후 관리한다. 로컬 등록은 Supabase 프로젝트 및 소유자별로 격리한다. 등록마다 발급된 client_id와 검증된 계정 sub, 호스트 ID, 마지막 모델을 보존한다. 같은 이메일의 여러 등록은 client_id 끝자리로 구분한다. 토큰 파일은 Windows 사용자 프로필의 %LOCALAPPDATA%/GPT-to-search 아래에 DPAPI CurrentUser로 보호하여 원자적으로 저장한다. Unix에서는 사용자 전용 디렉터리·0600 파일을 사용한다. 이 폴더를 다른 PC로 복사하지 않는다.

로그아웃 버튼은 Supabase 앱 세션을 종료한다. **ChatGPT 연결 해제**는 선택한 ChatGPT 등록의 갱신 토큰 폐기를 시도하고 로컬 토큰을 지운다. 원격 해제를 확인하지 못하면 화면에 안내한다. PC에서 이전에 승인한 등록은 다시 연결할 수 있다.

플랜 한도에 도달하면 실패한 시도와 수신한 부분 답변을 저장한다. 기존 API 키로 요청을 다시 보내는 경로는 없다. ChatGPT 설정에서 이 앱의 허용량 및 **한도 이후 ChatGPT 크레딧 사용 허용 여부**를 본인이 확인할 수 있다. [ChatGPT 사용량](https://chatgpt.com/settings/usage)

## 문제 확인

- 승인 취소·만료 시 앱의 원래 탭 또는 주소로 돌아가 다시 연결한다. 토큰 교환·서명·nonce 검증이 완료된 뒤에만 선택 계정이 바뀐다.
- 승인 후 모델 목록이 비어 있거나 HTTP 401/403이 표시되면 계정·워크스페이스·플랜 권한을 확인한다. 모델 이름을 환경 변수에 입력할 필요는 없다.
- subscription_sharing_usage_limit_exceeded는 ChatGPT 사용량 설정에서 확인한다. subscription_sharing_usage_unavailable은 잠시 후 수동 재시도한다. subscription_sharing_unsupported_capability는 새 질문에서 웹 검색을 끄거나 모델을 바꿔 확인한다.
- 오류를 전달할 때 화면의 HTTP 상태, 오류 코드, 표시된 요청 ID만 공유한다. 콜백 주소, 승인 URL, 쿠키, 토큰 파일, .env.local은 공유하지 않는다.

[공식 로그인 문서](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) · [토큰 갱신 및 폐기](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions) · [모델·스트림](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference) · [프리뷰 제약](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

## 이번 버전에서 확인한 범위

- 실제 Chromium에서 프로덕션 빌드와 Supabase HTTP fixture로 메인 세션을 열고, 로그인 버튼의 POST·303 응답을 거쳐 공식 OpenAI 로그인 화면까지 확인했다. OIDC discovery에서 공식 issuer·JWKS·revocation 주소를 확인했다.
- OAuth 공급자 fixture와 실제 루프백 리스너로 state 불일치, 승인 거부, 서명된 ID 토큰의 nonce 검증, 권한 누락, 재등록 client_id 불일치, 동시 토큰 갱신과 폐기를 검사했다.
- SDK가 만든 요청을 HTTP fixture에서 검사했다. 상충하는 API 키·base URL 환경 변수를 넣어도 공식 주소와 플랜 bearer만 사용했다. 검색이 꺼진 기본 대화와 검색 요청을 개별 호출해 실제 PGlite SQL 저장 및 재조회를 검사했다. 중간 한도 오류에서는 수신한 부분 답변과 실패 상태가 남았다.
- 실계정 코드 교환·갱신, 사용자 카탈로그, 실제 모델 답변·사용량 차감, 실제 웹 검색·인용은 Windows에서 본인이 승인한 후 확인할 항목이다. Windows PowerShell/DPAPI 경로는 구현했으며 이번 Linux 실행 환경에서는 Unix 파일 보호 경로를 실행했다.
