include $(TOPDIR)/rules.mk

PKG_NAME:=apcontroller
PKG_VERSION:=20250913
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/apcontroller
	SECTION:=admin
	CATEGORY:=Administration
	TITLE:=AP Controller
	DEPENDS:=+sshpass
	MAINTAINER:=Cezary Jackiewicz <cezary@eko.one.pl>
	PKGARCH:=all
endef

define Package/apcontroller/description
  Simple AP management system
endef

define Package/apcontroller/conffiles
/etc/config/apcontroller
endef

define Build/Compile
endef

define Package/apcontroller/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	[ -e /etc/uci-defaults/apcontroller ] && /etc/uci-defaults/apcontroller
	/etc/init.d/rpcd restart
	/etc/init.d/cron restart
	/usr/bin/apcontroller
fi
exit 0
endef

define Package/apcontroller/postrm
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	/etc/init.d/rpcd restart
	sed -i '/apcontroller/d' /etc/crontabs/root
	/etc/init.d/cron restart
fi
exit 0
endef

define Package/apcontroller/install
	$(INSTALL_DIR) $(1)
	$(CP) ./files/* $(1)
endef

$(eval $(call BuildPackage,apcontroller))
