include $(TOPDIR)/rules.mk
PKG_NAME:=router-privacy
PKG_VERSION:=0.1.0
PKG_RELEASE:=4
PKG_LICENSE:=GPL-3.0-or-later
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)
include $(INCLUDE_DIR)/package.mk
define Package/router-privacy
 SECTION:=net
 CATEGORY:=Network
 TITLE:=Independent DNS guard and traffic privacy evidence
 DEPENDS:=+luci-base +luci-compat +https-dns-proxy +ca-bundle +dnsmasq +nftables-json +kmod-nf-conntrack-netlink
endef
define Package/router-privacy/conffiles
/etc/config/router_privacy
endef
define Build/Prepare
 $(MKDIR) $(PKG_BUILD_DIR)
 $(CP) ./src/packet-observer.c $(PKG_BUILD_DIR)/
endef
define Build/Compile
 $(TARGET_CC) $(TARGET_CFLAGS) -std=c11 -Wall -Wextra $(TARGET_LDFLAGS) -o $(PKG_BUILD_DIR)/router-privacy-observer $(PKG_BUILD_DIR)/packet-observer.c
endef
define Package/router-privacy/install
 $(CP) ./root/* $(1)/
 $(INSTALL_DIR) $(1)/usr/lib/lua/luci $(1)/usr/sbin
 $(CP) ./luasrc/* $(1)/usr/lib/lua/luci/
 $(INSTALL_BIN) $(PKG_BUILD_DIR)/router-privacy-observer $(1)/usr/sbin/
endef
$(eval $(call BuildPackage,router-privacy))
