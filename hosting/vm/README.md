# 개인 전용 연구 서버 설치

대상은 고정 DNS 이름과 영구 디스크가 있는 Debian/Ubuntu 계열 Linux VM이다. 시스템 전체에서 사용할 수 있는 Node.js 24와 npm, systemd, Caddy가 필요하다. VM 제공자는 사용자가 선택한다. 이미 배포한 Sites 주소는 그대로 사용한다.

1. DNS의 A/AAAA를 VM의 실제 주소에 연결하고 80/443을 Caddy에 허용한다. 앱은 127.0.0.1:3000에서만 수신한다. Node 실행 파일은 /usr/local/bin 또는 /usr/bin에서 접근할 수 있어야 한다.
2. 전용 OS 사용자와 설치 위치를 준비한다. 아래 명령은 새 호스트의 관리자 셸에서 실행한다. 소스 묶음은 앱, 프록시 예시, SQL과 검증 도구를 함께 포함한다.

```sh
id gptsearch >/dev/null 2>&1 || useradd --system --user-group --create-home --home-dir /var/lib/gpt-search --shell /usr/sbin/nologin gptsearch
install -d -m 0700 -o gptsearch -g gptsearch /var/lib/gpt-search
install -d -m 0755 -o gptsearch -g gptsearch /srv/gpt-to-search
tar -xzf gpt-to-search-server.tar.gz -C /srv/gpt-to-search --strip-components=1 --no-same-owner
chown -R gptsearch:gptsearch /srv/gpt-to-search
install -d -m 0750 -o root -g gptsearch /etc/gpt-search
cd /srv/gpt-to-search
```

3. /etc/gpt-search/app.env에 .env.example의 네 필드를 설정한다. PRIVATE_APP_HTTPS_ORIGIN은 **VM의 HTTPS 원점**이다. /etc/gpt-search/worker.env에는 WORKER_OWNER_EMAIL과 WORKER_OWNER_PASSWORD만 둔다. 서비스 환경 파일은 한 줄에 한 변수로 작성하며 따옴표가 필요한 값은 감싼다. 두 파일 모두 Git·채팅 외부에서 입력한다.

```sh
chown root:gptsearch /etc/gpt-search/app.env
chmod 0640 /etc/gpt-search/app.env
chown root:root /etc/gpt-search/worker.env
chmod 0600 /etc/gpt-search/worker.env
runuser -u gptsearch -- npm ci
runuser -u gptsearch -- node --env-file=/etc/gpt-search/app.env node_modules/next/dist/bin/next build --webpack
install -m 0644 hosting/vm/*.service /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/gpt-search*.service
systemctl daemon-reload
systemctl enable --now gpt-search
```

4. Caddy의 기존 설정에 hosting/vm/Caddyfile의 사이트 블록을 추가한다. 블록의 `{$RESEARCH_HOST}`를 VM 도메인으로 교체하거나 Caddy 서비스 환경에 해당 변수를 정의한다. `caddy validate --config /etc/caddy/Caddyfile` 후 `systemctl reload caddy`를 실행한다. 공개 TLS 인증서를 발급한 뒤 `node hosting/vm/check-origin.mjs https://실제-VM-도메인`으로 웹 화면·운영 모드·미인증 401을 확인한다.
5. [통합 가이드](../../docs/13_integrated_mvp.md)의 SQL 점검과 플랜 승인을 완료한다. 플랜 등록은 앱과 같은 gptsearch 사용자와 영구 홈에서 관리한다. SSH 이전을 선택했다면 VM의 prepare 및 receive에는 `node --env-file=/etc/gpt-search/app.env --conditions=react-server scripts/plan-vm.mjs`를 사용한다. 두 프로세스가 같은 소유자 UUID와 홈을 사용해야 한다.
6. Sites 서버 환경 변수 RESEARCH_SERVER_ORIGIN에 검증된 VM 원점을 설정한다. Sites 화면에서 실제 소유자로 로그인한 후 채팅, 원문, 수동 갱신을 확인한다. `systemctl enable --now gpt-search-worker`로 자동 갱신을 켠다. `systemctl is-active gpt-search gpt-search-worker caddy`로 세 서비스를 확인한다.

운영 PC를 끈 상태에서 태블릿으로 같은 Sites 주소를 열어 저장된 문답과 자료를 다시 확인한다. 작업자 인증 실패는 `journalctl -u gpt-search-worker`에서 상태 코드로 확인할 수 있다.
