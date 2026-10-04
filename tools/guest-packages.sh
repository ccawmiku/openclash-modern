#!/bin/sh
set -eu
opkg update
opkg install luci luci-compat luci-i18n-base-zh-cn bash curl ruby ruby-yaml unzip ip-full
uci set luci.main.lang='zh_cn'
uci commit luci
/etc/init.d/uhttpd enable
/etc/init.d/uhttpd restart
df -h /
