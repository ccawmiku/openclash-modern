#!/bin/sh
set -eu
uci -q delete openclash.lab_server || true
uci set openclash.lab_server=servers
uci set openclash.lab_server.type=ss
uci set openclash.lab_server.name=Lab-Server
uci set openclash.lab_server.server=example.com
uci set openclash.lab_server.port=443
uci set openclash.lab_server.cipher=none
uci set openclash.lab_server.password=lab-only-placeholder
uci set openclash.lab_server.config=lab-example.yaml
uci -q delete openclash.lab_group || true
uci set openclash.lab_group=groups
uci set openclash.lab_group.name=Lab-Group
uci set openclash.lab_group.type=select
uci set openclash.lab_group.config=lab-example.yaml
uci -q delete openclash.lab_provider || true
uci set openclash.lab_provider=proxy-provider
uci set openclash.lab_provider.name=Lab-Provider
uci set openclash.lab_provider.type=http
uci set openclash.lab_provider.path=./proxy_provider/lab.yaml
uci set openclash.lab_provider.provider_url=https://example.com/lab.yaml
uci set openclash.lab_provider.config=lab-example.yaml
uci -q delete openclash.lab_dns || true
uci set openclash.lab_dns=dns_servers
uci set openclash.lab_dns.enabled=1
uci set openclash.lab_dns.type=https
uci set openclash.lab_dns.ip=dns.example.com/dns-query
uci set openclash.lab_dns.group=nameserver
uci -q delete openclash.lab_sub || true
uci set openclash.lab_sub=config_subscribe
uci set openclash.lab_sub.name=Lab-Subscription
uci set openclash.lab_sub.address=https://example.com/lab.yaml
uci commit openclash

