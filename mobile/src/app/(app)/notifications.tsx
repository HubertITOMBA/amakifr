import { useCallback, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, type Href } from "expo-router";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/api/notifications";
import {
  nextUnreadAfterDelete,
  nextUnreadAfterMarkAll,
  nextUnreadAfterMarkRead,
  notificationErrorMessage,
} from "@/api/notifications-state";
import { notificationLinkToMobileRoute } from "@/api/notification-link";
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
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { useUnreadCount } from "@/hooks/unread-count";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Écran Notifications — liste + sync compteur global.
 */
export default function NotificationsScreen() {
  const { unreadCount, refreshUnreadCount, setUnreadCountLocal } =
    useUnreadCount();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const guardRef = useRef<LoadGuard>(createLoadGuard());
  const hasLoadedRef = useRef(false);

  const load = useCallback(
    async (isRefresh = false) => {
      const started = beginLoad(guardRef.current);
      guardRef.current = started.guard;
      const gen = started.gen;

      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasLoadedRef.current) {
        setLoading(true);
      }
      setError(null);
      try {
        const list = await getNotifications({ limit: 50, offset: 0 });
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        setItems(list);
        hasLoadedRef.current = true;
        await refreshUnreadCount();
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
        if (ended.clearSpinners) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [refreshUnreadCount]
  );

  function bumpAfterMutation() {
    guardRef.current = invalidatePendingLoads(guardRef.current);
  }

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  async function onOpenNotification(n: NotificationDto) {
    setBusyId(n.id);
    try {
      if (!n.lue) {
        await markNotificationAsRead(n.id);
        bumpAfterMutation();
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, lue: true } : x))
        );
        setUnreadCountLocal((c) => nextUnreadAfterMarkRead(c, true));
        await refreshUnreadCount();
      }
      const route = notificationLinkToMobileRoute(n.lien);
      if (route) {
        router.push(route as Href);
      }
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) {
        bumpAfterMutation();
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        setUnreadCountLocal((c) => nextUnreadAfterDelete(c, !n.lue));
        await refreshUnreadCount();
        setError("Notification introuvable (mise à jour).");
      } else if (e instanceof ApiClientError) {
        setError(notificationErrorMessage(e));
      } else {
        setError("Impossible d'ouvrir la notification");
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
      setUnreadCountLocal(nextUnreadAfterMarkAll());
      await refreshUnreadCount();
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
      setUnreadCountLocal((c) => nextUnreadAfterDelete(c, !n.lue));
      await refreshUnreadCount();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) {
        bumpAfterMutation();
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        setUnreadCountLocal((c) => nextUnreadAfterDelete(c, !n.lue));
        await refreshUnreadCount();
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

  if (loading && items.length === 0) {
    return <LoadingState />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.unread} accessibilityRole="text">
          {unreadCount} non lue{unreadCount !== 1 ? "s" : ""}
        </Text>
        <SecondaryButton
          label="Tout marquer comme lu"
          loading={markingAll}
          disabled={unreadCount === 0}
          onPress={onMarkAll}
          style={styles.markAllBtn}
        />
      </View>

      {error ? <ErrorBanner message={error} /> : null}

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
            tintColor={AmakiColors.primary}
          />
        }
        ListEmptyComponent={
          error ? null : <EmptyState title="Aucune notification" />
        }
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={onOpenNotification}
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
    backgroundColor: AmakiColors.background,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: AmakiSpacing.lg,
    paddingVertical: AmakiSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AmakiColors.border,
    backgroundColor: AmakiColors.surface,
    gap: AmakiSpacing.sm,
  },
  unread: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    color: AmakiColors.primaryStrong,
    flex: 1,
  },
  markAllBtn: {
    flexShrink: 0,
  },
  list: {
    padding: AmakiSpacing.lg,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
});
