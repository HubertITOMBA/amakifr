import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HomeIconName } from "@/features/home/home-model";
import { HomeSymbolIcon } from "@/components/home/home-symbol-icon";
import {
  AmakiColors,
  AmakiRadius,
  AmakiTypography,
} from "@/constants/theme";

type Props = {
  label: string;
  href: Href;
  icon: HomeIconName;
  iconColor: string;
  iconBg: string;
  badge?: number | string;
};

/**
 * Carte d’action compacte verticale — libellé complet, jamais tronqué.
 */
export function QuickActionCard({
  label,
  href,
  icon,
  iconColor,
  iconBg,
  badge,
}: Props) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={badge !== undefined ? `${label}, ${badge}` : label}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <HomeSymbolIcon name={icon} color={iconColor} size={20} />
        {badge !== undefined ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "46%",
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 72,
    backgroundColor: AmakiColors.surface,
    borderRadius: AmakiRadius.md,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: AmakiRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: AmakiRadius.pill,
    backgroundColor: AmakiColors.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AmakiColors.surface,
  },
  badgeText: {
    color: AmakiColors.surface,
    fontSize: 9,
    fontWeight: "700",
  },
  label: {
    ...AmakiTypography.caption,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: AmakiColors.text,
    textAlign: "center",
    flexShrink: 0,
  },
});
