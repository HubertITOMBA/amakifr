import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NotificationDto } from "@/api/types";
import { formatNotificationDate } from "@/api/notifications-state";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Props = {
  notification: NotificationDto;
  onPress: (n: NotificationDto) => void;
  onDelete: (n: NotificationDto) => void;
  busy?: boolean;
};

/**
 * Carte notification (lu / non lu).
 */
export function NotificationItem({
  notification,
  onPress,
  onDelete,
  busy,
}: Props) {
  const unread = !notification.lue;

  return (
    <Card
      style={[
        styles.card,
        unread ? styles.cardUnread : styles.cardRead,
      ]}
      accessibilityRole="summary"
    >
      {unread ? <View style={styles.unreadBar} /> : null}
      <Pressable
        onPress={() => onPress(notification)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={
          unread
            ? `Notification non lue : ${notification.titre}`
            : `Notification : ${notification.titre}`
        }
        style={styles.main}
      >
        <View style={styles.header}>
          <Text
            style={[styles.title, unread && styles.titleUnread]}
            numberOfLines={2}
          >
            {notification.titre}
          </Text>
          {unread ? (
            <View style={styles.unreadDot} accessibilityLabel="Non lue" />
          ) : null}
        </View>
        <Text style={styles.message} numberOfLines={3}>
          {notification.message}
        </Text>
        <View style={styles.footer}>
          <StatusBadge label={notification.type} tone="neutral" />
          <Text style={styles.date}>
            {formatNotificationDate(notification.createdAt)}
          </Text>
        </View>
        {unread ? (
          <Text style={styles.unreadLabel}>Non lue</Text>
        ) : null}
      </Pressable>
      <Pressable
        onPress={() => onDelete(notification)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Supprimer la notification"
        style={styles.deleteBtn}
      >
        <Text style={styles.deleteText}>Supprimer</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: AmakiSpacing.sm,
    overflow: "hidden",
    padding: 0,
  },
  cardUnread: {
    borderColor: AmakiColors.primary,
    backgroundColor: AmakiColors.primarySoft,
  },
  cardRead: {
    backgroundColor: AmakiColors.surface,
  },
  unreadBar: {
    height: 3,
    backgroundColor: AmakiColors.primary,
  },
  main: {
    padding: AmakiSpacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.xs,
  },
  title: {
    flex: 1,
    ...AmakiTypography.body,
    fontWeight: "500",
    color: AmakiColors.textMuted,
  },
  titleUnread: {
    fontWeight: "700",
    color: AmakiColors.text,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: AmakiRadius.pill,
    backgroundColor: AmakiColors.primary,
    marginTop: 4,
  },
  message: {
    ...AmakiTypography.caption,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.sm,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: AmakiSpacing.sm,
  },
  date: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  unreadLabel: {
    ...AmakiTypography.label,
    color: AmakiColors.primary,
    marginTop: AmakiSpacing.sm,
    textTransform: "none",
  },
  deleteBtn: {
    borderTopWidth: 1,
    borderTopColor: AmakiColors.border,
    paddingVertical: AmakiSpacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AmakiColors.surface,
  },
  deleteText: {
    ...AmakiTypography.caption,
    color: AmakiColors.danger,
    fontWeight: "700",
  },
});
