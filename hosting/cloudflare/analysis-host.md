# Plus 분석 서버의 최소 배치

2026-11-20 기준, PC를 꺼도 같은 HTTPS 주소에서 연구를 계속하려면 현재 구현의 ChatGPT 플랜 자격 증명을 갱신할 수 있는 전용 호스트가 필요하다. 웹 UI, 인증, DB는 이미 별도로 운영할 수 있다.

| 위치 | 제공하는 기능 | 확인한 범위 |
|---|---|---|
| Workers Free / Sites | Next가 빌드한 브라우저 HTML·JS·CSS, Supabase 소유자 로그인·프로젝트 조회, 10분 Cron | 실제 계정의 프로젝트 조회 성공. 미로그인 조회는 401. 별도 Free 배포에서 실제 Next 로그인 화면을 PC·태블릿 Chromium으로 확인 |
| Supabase | Auth, 프로젝트·문답·자료·지식·이력, RLS, PDF 비공개 버킷, 갱신 선점·반영 트랜잭션 | 운영 DB에서 자료와 갱신 RPC를 확인. 임시 프로젝트의 선점과 고정 분석 결과 저장을 롤백으로 검증 |
| 전용 Linux VM | Node API의 플랜 금고와 갱신 토큰, 모델 스트림, 근거 분석과 DB 반영 | 원본 플랜을 승인하거나 공식 절차로 이전해야 실추론 가능 |
| 추가 기능을 제공할 때 | 현재 URL 수집기의 DNS 확인 후 IP 고정 연결, 별도 Node 프로세스로 PDF 추출, 원문·미니·심화 채팅 API | 기존 Next 서버가 담당. 로그인·프로젝트 어댑터에는 이 API가 구현되어 있지 않음 |

**자동 분석만 먼저 연결할 경우** 기존 Node 앱을 127.0.0.1:3000에서 유지하고 [Caddy 분석용 설정](Caddyfile.analysis)을 선택한다. 외부에 허용하는 경로는 POST /api/login, POST /api/logout, POST /api/projects/{uuid}/updates 세 가지다. Worker Cron이 Supabase 소유자로 로그인하고 한 프로젝트에서 manual=false로 처리한 후 로그아웃한다. 모델·토큰 갱신, OAuth 승인 및 콜백은 호스트 내부에서 관리한다. 같은 프로젝트에 Cron을 연결할 때 VM의 별도 자동 작업자까지 켤 필요는 없다. Caddy와 실제 Node 서버를 로컬 HTTPS로 검증해 GET /, /api/projects, /api/plan/status에서 404, 허용된 POST 갱신 요청에서 미인증 401을 확인했다. 기존 전체 VM 설정은 그대로 사용할 수 있다. [기존 VM 설치 절차](../vm/README.md) · [공식 플랜 이전 절차](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms)

## Workers Free 실측

- Next 프로덕션 빌드의 실제 로그인 화면을 Free Worker에 올렸다. 1440px·900px 브라우저에서 각각 JS/CSS 9개가 200이었고 화면 예외가 없었다. /api/mode는 200, 익명 /api/projects는 401이었다. UI Worker에서 같은 계정 workers.dev 백엔드를 일반 fetch로 호출했을 때 404/1042가 발생해 RESEARCH_API 서비스 바인딩을 배포했다. 기존 빌드 도구에 선택형 `--workers-api-service`를 주면 이 경로를 사용한다. 현재 백엔드가 제공하는 테스트 API 범위는 위 표와 같다. [Next 화면](https://gts-next-shell-check-20261120.jungmin0112nice.workers.dev) · [Cloudflare 서비스 바인딩](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- 별도 Free 진단 Worker에 앱의 실제 withVault와 파일 잠금 라이브러리를 번들했다. 첫 요청에서 금고에 테스트 표시를 쓰고 /tmp에 파일을 만들었다. 같은 요청에서 listen(0, "127.0.0.1")이 숫자 포트를 반환했다. 다음 요청에서 금고의 표시가 사라졌고 /tmp 파일도 ENOENT였다. 기록된 CPU 시간은 각각 5ms와 1ms였다. 이 수치는 두 파일 시험에 해당한다. 브라우저의 루프백 콜백은 브라우저가 실행되는 기기에 도착하며 Worker에 전달되지 않는다. 현재 파일 금고로 요청 사이에 플랜 승인·refresh 상태를 유지할 수 없어 실제 Plus 요청은 수행하지 않았다. [Workers 파일시스템](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/) · [공식 OAuth 호스트 절차](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms)
- 진단 Worker는 측정 후 삭제했다. 같은 동작을 재현할 [진단 소스](tests/plus-runtime-probe.mjs)는 임의 계정 플래그 대신 금고의 pending 필드에 fixture-marker를 넣는다. 운영 토큰을 읽거나 요청하지 않는다. 패키지 루트에서 아래와 같이 별도 esbuild 0.28.2로 빌드하고 임시 Worker의 nodejs_compat 환경에서 /capabilities → /second-request 순서로 요청한다. 기존 계정·금고를 연결하지 않는다.

```sh
esbuild hosting/cloudflare/tests/plus-runtime-probe.mjs --bundle --platform=node --format=esm --conditions=react-server --minify \
  --banner:js='import {createRequire} from "node:module";const require=createRequire(import.meta.url);' \
  --define:process.env.OWNER_USER_ID='"fixture-owner"' \
  --define:process.env.NEXT_PUBLIC_SUPABASE_URL='"https://fixture.invalid"' \
  --outfile=/tmp/gts-plus-probe.mjs
```

- 최근 예약 이벤트는 outcome=ok, result=unconfigured였다. DB에 대기 3건·처리 시도 0건을 확인했다. 무료 Cron 실행과 실제 모델 분석은 따로 검증해야 한다. VM 연결 후 기준 대기 수·시도 수 기록 → 예약 이벤트 → 변경 이력과 근거 원문 확인 순으로 검증한다. [Worker 설정 변수](README.md#예약-갱신)

## 운영 사양과 빌드 사양

단일 사용자용 **운영 시작점은 Linux 1 vCPU, RAM 2GiB, 영구 디스크 20GiB**로 잡는다. 이는 보장된 하한이 아니다. Node 24와 Next 서버, Caddy, OS, 파일 금고를 포함하며, PDF를 여러 건 동시에 추출하는 부하는 아직 측정하지 않았다. 영구 디스크에는 서비스 계정의 홈과 호스트 고유 금고를 보존한다. 원문 PDF의 영구 저장소는 Supabase다. 공급자의 최소 부팅 디스크가 더 크면 그 규격을 따른다.

Linux x86-64·Node 24·Next 16 환경에서 .next 캐시를 비운 프로덕션 빌드를 측정했다. 0.1초 간격으로 npm과 하위 빌드 프로세스의 PSS(공유 메모리 비례 반영)를 합한 최고값이 **약 990MiB**, 빌드 시간은 약 31초였다. 빌드된 Next 서버를 시작한 뒤 8초간 무부하 상태의 최고 PSS는 **약 99MiB**였다. 1쪽 PDF fixture 추출 자식 프로세스의 최고 RSS는 별도로 약 51MiB였다. 실제 코드의 PDF 힙 한도는 256MiB이며 전체 프로세스 메모리는 더 클 수 있다. 운영체제·모델 스트리밍·동시 요청 메모리는 위 무부하 수치에 포함되지 않는다.

**현장 빌드는 RAM 4GiB를 시작점으로 권장한다.** 1GiB VM은 별도 Linux 빌더를 쓰고 같은 아키텍처·Node 버전·libc에 맞춘 의존성과 빌드 결과(.next 포함)를 배치해야 한다. 현재 VM 서비스의 실행 명령은 Next start이므로 앱 소스·운영 의존성·스크립트도 필요하다. 1GiB 후보는 우선 동시 분석 한 건으로 시험하고 메모리 부족·재시작·지연을 측정한다. ARM VM의 빌드·실운영 성능은 미검증이다.

## 무료 VM 후보

| 후보 | 무료 적용 조건 | 이 앱에서의 판단 |
|---|---|---|
| Oracle Cloud Always Free, Ampere A1 | 홈 리전 VM.Standard.A1.Flex의 월 1,500 OCPU·시간 및 9,000 GB·시간. Always Free 테넌시 기준 총 2 OCPU·12GB에 해당한다. 부트·블록 볼륨 합계 200GB, 인스턴스당 최소 부트 볼륨 47GB | 1 OCPU·4GB, 기본 부트 볼륨 약 50GB부터 시험할 수 있다. 이미지가 무료 대상인지, 해당 리전의 A1 재고·잔여 한도를 확인한다. 7일 유휴 기준에 따라 회수될 수 있으므로 플랜 재승인·복구 수단을 보관한다. [Oracle 공식 무료 리소스](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) |
| Google Cloud Free Tier, e2-micro | 비선점형 1대 상당 시간, us-west1·us-central1·us-east1 중 하나. RAM 1GiB·공유 CPU 0.25 vCPU 상당. pd-standard 30GB·월 및 제한된 북미발 외부 전송량 1GB·월 | 별도 빌더가 필요한 소형 후보. 표준 VM에 연결한 외부 IPv4는 계정당 월 첫 1시간 무료 후 시간당 US$0.005다. 월 730시간 연결하면 주소만 약 US$3.65이며 기타 사용료·세금은 별도다. 상시 공인 IPv4 구성으로 월 0원을 보장할 수 없다. [무료 범위](https://cloud.google.com/free/docs/free-cloud-features#compute) · [공유 코어 사양](https://cloud.google.com/compute/docs/general-purpose-machines#e2_shared-core) · [IPv4 요금](https://cloud.google.com/vpc/network-pricing#ipaddress) |

계정별 무료 잔여량·가입 가능 리전·서버 재고·공인 주소와 트래픽 비용은 공급자 콘솔에서 최종 확인한다. 유료 전환이나 VM 생성을 수행하지 않았다.
