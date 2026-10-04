include $(TOPDIR)/rules.mk
PKG_NAME:=luci-app-openclash-modern
PKG_VERSION:=0.1.0
PKG_RELEASE:=3
PKG_LICENSE:=GPL-3.0-or-later
include $(INCLUDE_DIR)/package.mk
define Package/luci-app-openclash-modern
 SECTION:=luci
 CATEGORY:=LuCI
 TITLE:=Modern OpenClash management UI
 DEPENDS:=+luci-app-openclash +luci-compat +ruby-yaml
 PKGARCH:=all
endef
define Build/Compile
endef
define Package/luci-app-openclash-modern/install
 $(CP) ./root/* $(1)/
endef
$(eval $(call BuildPackage,luci-app-openclash-modern))
