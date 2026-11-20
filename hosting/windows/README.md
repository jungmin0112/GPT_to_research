# Windows PC에서 개인용 연구 앱 운영하기

폰 → Cloudflare Access(소유자 이메일) → HTTPS Tunnel → PC의 127.0.0.1:3000 → Supabase 소유자 로그인 순서로 연결한다. Plus 승인과 토큰 저장은 PC에서 처리한다. PC가 깨어 있고 해당 Windows 사용자가 로그인해 있는 동안 이용할 수 있다. 화면 잠금은 가능하다.

## PC에서 처음 실행

1. Node.js 24 LTS와 npm을 설치한다. 이 브랜치를 기존 앱과 **별도 폴더**에 풀고 기존 앱의 `.env.local`을 이 폴더로 복사한다. Supabase URL, publishable/anon 키, OWNER_USER_ID는 기존 값을 사용한다. 같은 프로젝트와 같은 Windows 사용자라면 기존 Plus 연결을 읽는다. 새 SQL은 없다.
2. ZIP으로 받았다면 먼저 파일 속성에서 다운로드한 ZIP의 차단을 해제하고 압축을 푼다. 기존 앱이 3000 포트를 사용 중이면 그 앱을 정상 종료한다. 새 앱 폴더의 일반 PowerShell에서 아래 명령을 실행한다. 로컬 대화 상자에 기존 **Supabase 앱 소유자** 이메일과 암호를 입력한다. 이 암호는 Windows 사용자 DPAPI로 보호된다. -Register는 선택 사항으로, 다음 사용자 로그인 시 실행할 예약 작업을 만든다.

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\hosting\windows\start.ps1 -Setup -Build -Register
~~~

3. PC에서 http://127.0.0.1:3000 을 열어 로그인한 뒤 프로젝트 설정에서 기존 Plus 연결 상태를 확인한다. 필요할 때만 그 로컬 화면에서 Sign in with ChatGPT를 승인한다. 다시 실행할 때는 같은 명령에서 -Setup -Build -Register를 생략한다. 포트 포워딩이나 Windows 인바운드 방화벽 개방은 필요 없다.
4. 최초 실행 창은 계속 열어 둔다. 수동 시작한 서버는 Ctrl+C로 중지한다. 예약 작업을 해제하려면 작업 스케줄러에서 **GPT to research PC**를 사용 안 함으로 바꾼다. 자동 실행에 실패하면 같은 사용자 터미널에서 스크립트를 실행해 오류를 확인한다.

## 한 번 실행하는 PC 부하 측정

Plus 승인 후 별도 PowerShell에서 앱 폴더를 열고 아래 명령을 실행한다. 같은 사용자의 Plus 사용량과 Supabase에 **새 벤치마크 프로젝트와 공개 SI 정의 한 건**을 사용한다. 기존 프로젝트는 측정 대상으로 선택하지 않는다.

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\hosting\windows\measure.ps1
~~~

마지막에 출력한 JSON 경로를 연다. build는 의존성 설치를 제외한 프로덕션 빌드, idle은 서버가 준비된 뒤 요청 없는 10초, emptyQueue는 빈 프로젝트의 자동 갱신 요청 한 번, analysis는 공개 텍스트 한 건의 Plus 수동 갱신이다. 각 구간은 전체 논리 CPU 용량 대비 평균 CPU(%)와 200ms 간격으로 관측한 프로세스 트리 working set 합계의 최대값(MiB)을 담는다. 짧은 메모리 급증은 빠질 수 있다. 별도 포트·임시 설치에서 실행한 서버와 측정용 Node 프로세스 및 자식이 대상이다. 기존 앱, 상시 작업자의 대기 프로세스, cloudflared, 원격 추론 서버의 자원은 집계에서 제외한다. 남은 프로젝트에서 원문과 근거를 다시 열 수 있다. result.evidenceVerified가 true여야 노드 저장과 원문 인용 연결까지 성공한 것이다. 중간 오류는 failureStep과 HTTP 상태를 확인한다.

빌드만 무거운 경우 같은 CPU 아키텍처의 다른 Windows PC에 같은 커밋과 Node 버전을 준비한다. 동일한 프로젝트의 두 NEXT_PUBLIC_SUPABASE 값으로 npm ci와 npm run build를 실행한다. 소스와 빌드 산출물 .next를 대상 PC의 동일 커밋 폴더에 배치하고(.next/cache는 생략 가능), 대상 PC에서 npm ci로 네이티브 의존성을 설치한다. 대상 PC의 .env.local과 Windows 사용자 토큰은 그대로 사용하고 start.ps1에서 -Build를 생략한다. 이 교차 PC 배치 절차는 대상 PC에서 확인이 필요하다.

## 외부 HTTPS 주소 연결

현재 Cloudflare 계정에는 관리 중인 DNS zone이 없고 Zero Trust Access도 미가입이다. 고정 공개 이름은 보류 상태다. 소유 중인 도메인이 있으면 Cloudflare의 **Domains → Onboard a domain**에서 Free로 추가해 DNS를 활성화한다. 소유 도메인이 없으면 로컬 앱과 부하 측정부터 사용할 수 있다.

1. [Zero Trust](https://one.dash.cloudflare.com/)에서 Free 요금제로 팀을 만들고 팀 이름을 확인한다. Access controls → Applications → Add an application → Self-hosted에서 사용할 정확한 서브도메인 하나를 등록한다. Allow 정책의 Include는 본인 이메일 주소 하나로 지정한다. One-time PIN 등 본인이 사용할 로그인 방식을 켠다. 이 호스트 전체에 정책을 적용한다.
2. 앱 세부 정보에서 Application Audience(AUD)를 확인한다. 로컬 .env.local에 아래 값을 채운 후 앱을 재시작한다. 원격 API는 Access 발급 서명, 발급자, 대상 앱, 만료와 이메일을 확인하고 그 뒤에 Supabase 권한을 확인한다.

~~~dotenv
PRIVATE_APP_HTTPS_ORIGIN=https://research.example.org
CF_ACCESS_TEAM_DOMAIN=YOUR-TEAM.cloudflareaccess.com
CF_ACCESS_AUD=YOUR-APP-AUD
CF_ACCESS_OWNER_EMAIL=YOUR-LOGIN-EMAIL
~~~

3. Zero Trust → Networks → Connectors → Cloudflare Tunnels에서 **gpt-to-research-windows**를 선택한다. Windows 커넥터 설치 화면에서 공식 cloudflared를 설치하고 그 PC의 관리자 터미널에서 화면의 서비스 설치 명령을 실행한다. 커넥터 토큰은 그 PC에서만 사용한다. 대시보드에서 Healthy를 확인한다.
4. Access 보호를 먼저 적용한 뒤 터널의 Published application route에 같은 호스트와 HTTP 서비스 **127.0.0.1:3000**을 설정한다. HTTP Host Header는 공개 호스트명으로 지정한다. Protect with Access가 제공되면 활성화하고 동일 팀·AUD를 선택한다. 일치하지 않는 호스트의 마지막 규칙은 404로 유지한다. DNS의 프록시된 터널 레코드가 생성됐는지 확인한다.
5. 폰에서 Wi-Fi를 끄고 시크릿 창으로 그 HTTPS 주소를 연다. Access 인증 전 앱이 열리지 않아야 한다. 허용한 이메일 인증 후 기존 Supabase 계정으로 로그인한다. PC에서 승인한 Plus로 답변 하나를 받고 벤치마크 프로젝트에서 지식 노드와 원문 근거를 연다. 태블릿에서도 같은 주소를 사용한다. 다른 이메일로는 Access에서 거절되어야 한다.

## 자동 갱신과 절전

기존 로컬 작업자가 시작 즉시, 이후 약 1분마다 프로젝트별 자동 갱신 가능 여부를 확인한다. DB가 기본 10분 및 활동량 기준으로 처리 시점을 정한다. PC 모드에서 브라우저는 결과를 읽고 수동 갱신은 계속 사용할 수 있다. Cloudflare 테스트 Worker의 10분 cron은 해제했다. PC 운영 중에는 같은 프로젝트를 처리하는 클라우드 예약을 다시 켜지 않는다. 절전 중에는 서비스가 중단되고, 복귀 후 다음 폴링에서 만기 작업을 처리한다. 재부팅한 경우 같은 Windows 사용자로 로그인해야 앱과 작업자가 시작된다. DB의 작업 잠금·만료 및 티켓 검사가 중복 반영을 막는다.
