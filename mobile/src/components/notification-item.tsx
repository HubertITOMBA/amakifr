import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NotificationDto } from "@/api/types";
import { formatNotificationDate } from "@/api/notifications-state";

type Props = {
  notification: NotificationDto;
  onPress: (n: NotificationDto) => void;
  onDelete: (n: NotificationDto) => void;
  busy?: boolean;
};

/**
 * Ligne de notification (lu / non lu).
 */
export function NotificationItem({
  notification,
  onPress,
  onDelete,
  busy,
}: Props) {
  const unread = !notification.lue;

  return (
    <View
      style={[styles.card, unread ? styles.cardUnread : styles.cardRead]}
      accessibilityRole="summary"
    >
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
          <Text style={[styles.title, unread && styles.titleUnread]}>
            {notification.titre}
          </Text>
          {unread ? <Text style={styles.badge}>Non lue</Text> : null}
        </View>
        <Text style={styles.message} numberOfLines={3}>
          {notification.message}
        </Text>
        <Text style={styles.meta}>
          {notification.type} · {formatNotificationDate(notification.createdAt)}
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardUnread: {
    backgroundColor: "#eff6ff",
    borderColor: "#93c5fd",
  },
  cardRead: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
  },
  main: {
    padding: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#334155",
  },
  titleUnread: {
    fontWeight: "700",
    color: "#0f172a",
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8",
    textTransform: "uppercase",
  },
  message: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: "#94a3b8",
  },
  deleteBtn: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  deleteText: {
    color: "#b91c1c",
    fontWeight: "600",
    fontSize: 13,
  },
});
