include $(TOPDIR)/rules.mk
PKG_NAME:=router-node-health
PKG_VERSION:=0.1.0
PKG_RELEASE:=3
PKG_LICENSE:=GPL-3.0-or-later
include $(INCLUDE_DIR)/package.mk
define Package/router-node-health
 SECTION:=net
 CATEGORY:=Network
 TITLE:=Independent Mihomo node availability and history
 DEPENDS:=+luci-base +luci-compat
 PKGARCH:=all
endef
define Package/router-node-health/conffiles
/etc/config/router_node_health
endef
define Build/Compile
endef
define Package/router-node-health/install
 $(CP) ./root/* $(1)/
 $(INSTALL_DIR) $(1)/usr/lib/lua/luci
 $(CP) ./luasrc/* $(1)/usr/lib/lua/luci/
endef
$(eval $(call BuildPackage,router-node-health))
