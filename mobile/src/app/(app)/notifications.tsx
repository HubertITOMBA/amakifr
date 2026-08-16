import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/api/notifications";
import {
  nextUnreadAfterDelete,
  nextUnreadAfterMarkAll,
  nextUnreadAfterMarkRead,
  notificationErrorMessage,
} from "@/api/notifications-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  invalidatePendingLoads,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { ApiClientError, type NotificationDto } from "@/api/types";
import { NotificationItem } from "@/components/notification-item";

/**
 * Écran Notifications — liste + unread + mark read / mark all / delete.
 */
export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const guardRef = useRef<LoadGuard>(createLoadGuard());

  const load = useCallback(async (isRefresh = false) => {
    const started = beginLoad(guardRef.current);
    guardRef.current = started.guard;
    const gen = started.gen;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [list, count] = await Promise.all([
        getNotifications({ limit: 50, offset: 0 }),
        getUnreadNotificationCount(),
      ]);
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setItems(list);
      setUnread(count);
    } catch (e) {
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      if (e instanceof ApiClientError) {
        setError(notificationErrorMessage(e));
      } else {
        setError("Impossible de charger les notifications");
      }
    } finally {
      const ended = endLoad(guardRef.current);
      guardRef.current = ended.guard;
      // Toujours libérer le spinner quand plus aucun load en vol
      // (même si ce load a été invalidé par une mutation).
      if (ended.clearSpinners) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  /** Invalide les GET en cours avant d'appliquer un état mutation local. */
  function bumpAfterMutation() {
    guardRef.current = invalidatePendingLoads(guardRef.current);
  }

  useEffect(() => {
    void load(false);
  }, [load]);

  async function onMarkRead(n: NotificationDto) {
    if (n.lue) return;
    setBusyId(n.id);
    try {
      await markNotificationAsRead(n.id);
      bumpAfterMutation();
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, lue: true } : x))
      );
      setUnread((c) => nextUnreadAfterMarkRead(c, true));
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) {
        bumpAfterMutation();
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        setUnread((c) => nextUnreadAfterDelete(c, !n.lue));
        setError("Notification introuvable (mise à jour).");
      } else if (e instanceof ApiClientError) {
        setError(notificationErrorMessage(e));
      } else {
        setError("Impossible de mettre à jour la notification");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onMarkAll() {
    setMarkingAll(true);
    setError(null);
    try {
      await markAllNotificationsAsRead();
      bumpAfterMutation();
      setItems((prev) => prev.map((x) => ({ ...x, lue: true })));
      setUnread(nextUnreadAfterMarkAll());
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(notificationErrorMessage(e));
      } else {
        setError("Impossible de tout marquer comme lu");
      }
    } finally {
      setMarkingAll(false);
    }
  }

  function confirmDelete(n: NotificationDto) {
    Alert.alert("Supprimer cette notification ?", n.titre, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          void onDelete(n);
        },
      },
    ]);
  }

  async function onDelete(n: NotificationDto) {
    setBusyId(n.id);
    try {
      await deleteNotification(n.id);
      bumpAfterMutation();
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      setUnread((c) => nextUnreadAfterDelete(c, !n.lue));
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) {
        bumpAfterMutation();
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        setUnread((c) => nextUnreadAfterDelete(c, !n.lue));
        setError("Notification déjà absente.");
      } else if (e instanceof ApiClientError) {
        setError(notificationErrorMessage(e));
      } else {
        setError("Impossible de supprimer la notification");
      }
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.unread}>
          {unread} non lue{unread !== 1 ? "s" : ""}
        </Text>
        <Pressable
          onPress={onMarkAll}
          disabled={markingAll || unread === 0}
          accessibilityRole="button"
          accessibilityLabel="Tout marquer comme lu"
          style={[
            styles.markAll,
            (markingAll || unread === 0) && styles.markAllDisabled,
          ]}
        >
          {markingAll ? (
            <ActivityIndicator color="#1d4ed8" size="small" />
          ) : (
            <Text style={styles.markAllText}>Tout marquer comme lu</Text>
          )}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          items.length === 0 ? styles.emptyContainer : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor="#1d4ed8"
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Aucune notification</Text>
        }
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={onMarkRead}
            onDelete={confirmDelete}
            busy={busyId === item.id}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  unread: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e3a8a",
  },
  markAll: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  markAllDisabled: {
    opacity: 0.4,
  },
  markAllText: {
    color: "#1d4ed8",
    fontWeight: "600",
    fontSize: 13,
  },
  error: {
    color: "#b91c1c",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  list: {
    padding: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  empty: {
    color: "#64748b",
    fontSize: 16,
  },
});
