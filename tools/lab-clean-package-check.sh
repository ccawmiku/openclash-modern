set -eu
clean_root="/tmp/rp-fresh-$(date +%s)"
mkdir -p "$clean_root/var/lock" "$clean_root/usr/lib/opkg/info" "$clean_root/etc/opkg"
cp /etc/opkg.conf "$clean_root/etc/opkg.conf"
printf 'arch all 1\narch x86_64 10\n' > "$clean_root/etc/opkg/arch.conf"
# Base dependency inventory comes from the actual lab; add-on paths stay empty.
awk 'BEGIN {RS="";ORS="\n\n"} !/^Package: (luci-app-openclash-modern|router-privacy|router-node-health)\n/ {print}' /usr/lib/opkg/status > "$clean_root/usr/lib/opkg/status"
cp /usr/lib/opkg/info/*.list "$clean_root/usr/lib/opkg/info/"
opkg --offline-root "$clean_root" --nodeps --force-depends install /tmp/rp-packages/luci-app-openclash-modern_0.1.0-1_all.ipk /tmp/rp-packages/router-privacy_0.1.0-1_x86_64.ipk /tmp/rp-packages/router-node-health_0.1.0-1_all.ipk
test -f "$clean_root/usr/share/openclash-modern/validate_yaml.rb"
test -f "$clean_root/usr/share/router-privacy/analytics.lua"
test -x "$clean_root/usr/sbin/router-privacy-observer"
test -x "$clean_root/etc/init.d/router-privacy"
test -x "$clean_root/etc/init.d/router-node-health"
test -f "$clean_root/usr/share/router-node-health/history.lua"
test -f "$clean_root/www/luci-static/openclash-modern/.vite/manifest.json"
echo 'Fresh-root package extraction and executable modes passed; dependency resolution tested separately on the live lab.'
