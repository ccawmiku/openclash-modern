#!/bin/sh
set -eu
mkdir -p /etc/openclash/config
cat > /etc/openclash/config/lab-example.yaml <<'EOF'
# Local synthetic fixture; no subscription or credentials.
mode: rule
log-level: info
proxies: []
proxy-groups:
  - name: Lab
    type: select
    proxies: [DIRECT]
rules:
  - MATCH,DIRECT
EOF
printf '%s\n' '2026-10-03 12:00:00 [Info] Local VM synthetic log' 'time="2026-10-03T12:00:00+08:00" level=info msg="UI integration fixture"' > /tmp/openclash.log
