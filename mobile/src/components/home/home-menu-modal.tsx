import { router } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  resolveHomeMenuBadge,
  type HomeMenuItemDef,
} from "@/features/home/home-model";
import { HomeSymbolIcon } from "@/components/home/home-symbol-icon";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  items: HomeMenuItemDef[];
  unreadCount: number;
  chatUnread: number;
};

/**
 * Menu hamburger complet — fermeture après navigation.
 */
export function HomeMenuModal({
  visible,
  onClose,
  items,
  unreadCount,
  chatUnread,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer le menu"
      />
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, AmakiSpacing.lg) },
        ]}
      >
        <Text style={styles.title}>Menu</Text>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => {
            const badge = resolveHomeMenuBadge(
              item.id,
              unreadCount,
              chatUnread
            );
            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  badge !== undefined ? `${item.label}, ${badge}` : item.label
                }
                onPress={() => {
                  onClose();
                  router.push(item.href);
                }}
              >
                <View style={styles.iconWrap}>
                  <HomeSymbolIcon
                    name={item.icon}
                    color={AmakiColors.primary}
                    size={20}
                  />
                </View>
                <Text style={styles.label}>{item.label}</Text>
                {badge !== undefined ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: AmakiColors.surface,
    borderTopLeftRadius: AmakiRadius.lg,
    borderTopRightRadius: AmakiRadius.lg,
    paddingTop: AmakiSpacing.lg,
    paddingHorizontal: AmakiSpacing.lg,
    maxHeight: "78%",
  },
  title: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.md,
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: AmakiSpacing.md,
    paddingVertical: AmakiSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AmakiColors.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: AmakiRadius.sm,
    backgroundColor: AmakiColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    flex: 1,
    fontWeight: "600",
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: AmakiRadius.pill,
    backgroundColor: AmakiColors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: AmakiColors.surface,
    fontSize: 11,
    fontWeight: "700",
  },
});
