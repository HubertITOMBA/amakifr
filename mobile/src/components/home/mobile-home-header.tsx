import { Platform, StatusBar as RNStatusBar, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatTabUnreadBadge } from "@/api/notifications-state";
import { HomeSymbolIcon } from "@/components/home/home-symbol-icon";
import {
  AmakiGradientShell,
  AmakiHeaderIconButton,
} from "@/components/layout/amaki-gradient-header";
import { HOME_HEADER_ROW_PAD_BOTTOM } from "@/features/home/home-header-layout";
import {
  HEADER_VISUAL_BODY_HOME,
  headerContentPaddingTop,
  resolveHeaderStatusInset,
} from "@/features/layout/gradient-header-model";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";
import { StatusBar } from "expo-status-bar";

type Props = {
  unreadCount: number;
  onOpenMenu: () => void;
};

/**
 * Header marque accueil — coque dégradé partagée ; rangée inchangée (validée).
 */
export function MobileHomeHeader({ unreadCount, onOpenMenu }: Props) {
  const insets = useSafeAreaInsets();
  const badge = formatTabUnreadBadge(unreadCount);
  const statusInset = resolveHeaderStatusInset(
    insets.top,
    Platform.OS === "android" ? RNStatusBar.currentHeight : null
  );
  const padTop = headerContentPaddingTop(statusInset);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AmakiGradientShell
        statusInset={statusInset}
        visualBody={HEADER_VISUAL_BODY_HOME}
      >
        <View style={[styles.row, { paddingTop: padTop }]}>
          <View style={styles.left}>
            <AmakiHeaderIconButton
              accessibilityLabel="Ouvrir le menu"
              onPress={onOpenMenu}
            >
              <HomeSymbolIcon name="menu" color="#ffffff" size={22} />
            </AmakiHeaderIconButton>
            <Text style={styles.brand} accessibilityRole="header">
              AMAKI
            </Text>
          </View>
          <View style={styles.actions}>
            <AmakiHeaderIconButton
              accessibilityLabel={
                badge !== undefined
                  ? `Notifications, ${badge} non lues`
                  : "Notifications"
              }
              onPress={() => router.push("/notifications")}
            >
              <HomeSymbolIcon
                name="notifications"
                color="#ffffff"
                size={22}
              />
              {badge !== undefined ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            </AmakiHeaderIconButton>
            <AmakiHeaderIconButton
              accessibilityLabel="Profil"
              onPress={() => router.push("/profil")}
            >
              <HomeSymbolIcon name="profil" color="#ffffff" size={22} />
            </AmakiHeaderIconButton>
          </View>
        </View>
      </AmakiGradientShell>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
    zIndex: 0,
    elevation: 0,
    overflow: "visible",
    marginTop: 0,
    paddingTop: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: AmakiSpacing.lg,
    paddingBottom: HOME_HEADER_ROW_PAD_BOTTOM,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: AmakiSpacing.sm,
    flexShrink: 1,
  },
  brand: {
    ...AmakiTypography.title,
    color: "#ffffff",
    letterSpacing: 1.4,
    fontWeight: "800",
    fontSize: 22,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: AmakiSpacing.sm,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: AmakiRadius.pill,
    backgroundColor: AmakiColors.danger,
    borderWidth: 1,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
});
